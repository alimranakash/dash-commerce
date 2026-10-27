import { receiptTimeZone, SALE_PAYMENT_METHOD_LABELS } from "./sale-receipt";
import { formatSaleMoney } from "./sale-scan";
import type { SalePaymentMethod, SaleStatus } from "./sale.schema";

/*
 * The Daily Sales Report: one business day of counter sales, worked out from
 * what each sale already stores and nothing else. No figure here is a new
 * record, and the arithmetic is pure so `npm run verify:daily-sales-report`
 * can drive every one of them without a database.
 *
 * Three facts about the data decide the definitions, and the page says each of
 * them in words rather than papering over it:
 *
 * - A sale's day is its `saleDate` — the day staff chose on the form, which is
 *   what the sales list filters by and the receipt prints.
 * - A sale is in exactly one state now. Each day's sales are split by it —
 *   completed, returned, cancelled — so a returned sale is a return and not
 *   also a sale with a refund taken off it, and nothing is counted twice. A
 *   draft is not a sale yet and is counted in none of them.
 * - There is no payment ledger. A sale carries one payment method and one paid
 *   amount, which an edit overwrites. "Received" is therefore the paid amount
 *   recorded on the day's completed sales, by the method recorded on each; a
 *   balance settled on a later day stays with the day the sale was made, and a
 *   payment split across two methods cannot be told apart from one.
 */

export type ReportMoney = { toString(): string } | null | undefined;

/** The store the session resolved, and the only thing a query may be scoped by. */
export type DailyReportScope = { organizationId: string; storeId: string };

export const DAILY_REPORT_PATH = "/dashboard/sales/daily-report";

/** Sales the shop made. A draft is not one until it is completed. */
export const REPORTED_SALE_STATUSES = [
  "COMPLETED",
  "RETURNED",
  "CANCELLED"
] as const satisfies readonly SaleStatus[];

/** Every method the sale form offers, in the order the report lists them — all of them, every day. */
export const DAILY_REPORT_PAYMENT_METHODS = [
  "CASH",
  "BKASH",
  "NAGAD",
  "CARD",
  "BANK",
  "COD",
  "OTHER"
] as const satisfies readonly SalePaymentMethod[];

export const DAILY_REPORT_PAGE_SIZE = 50;
/** The most rows "Print all" renders: a day's counter, never a whole history. */
export const DAILY_REPORT_PRINT_LIMIT = 1000;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

/* -------------------------------------------------------------------------- */
/* The business day                                                           */
/* -------------------------------------------------------------------------- */

/** A real calendar day as `YYYY-MM-DD`, or null — never a guess. */
export function parseReportDay(value: unknown): string | null {
  const raw = Array.isArray(value) ? value[0] : value;

  if (typeof raw !== "string") {
    return null;
  }

  const text = raw.trim();
  const match = DAY_PATTERN.exec(text);

  if (!match) {
    return null;
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));

  return year >= 1970 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? text
    : null;
}

/** The calendar day a moment falls on in a timezone — the receipt's `calendarDay`. */
export function reportDayInTimeZone(moment: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric"
  }).format(moment);
}

/**
 * The store's timezone, as the receipt resolves it, and today's date in it —
 * so a shop in Dhaka opens tomorrow's report at its own midnight, not at
 * 06:00 when UTC gets there.
 */
export function dailyReportClock(storeTimeZone: string | null | undefined, now: Date = new Date()) {
  const timeZone = receiptTimeZone(storeTimeZone);

  return { timeZone, today: reportDayInTimeZone(now, timeZone) };
}

export function shiftReportDay(day: string, days: number) {
  const [year, month, date] = dayParts(day);

  return new Date(Date.UTC(year, month - 1, date + days)).toISOString().slice(0, 10);
}

/**
 * Which stored `saleDate` values are this business day.
 *
 * `parseSaleDate` stores the day staff chose as midnight in the server's own
 * timezone — UTC where it is deployed, whatever a developer's machine is set to.
 * A 24-hour window centred on that day's UTC midnight contains its midnight
 * for any server offset from UTC−11 to UTC+12 and no other day's, so the report
 * finds the same sales wherever it runs and never asks the browser.
 */
export function saleDateWindow(day: string) {
  const [year, month, date] = dayParts(day);
  const midnight = Date.UTC(year, month - 1, date);

  return { gte: new Date(midnight - HALF_DAY_MS), lt: new Date(midnight + HALF_DAY_MS) };
}

/**
 * Every filter the report runs, built from the session's store and the day and
 * from nothing the browser sent — so each one carries this organization and
 * this store, and a customer's name can only arrive on a sale of this store.
 */
export function dailyReportWhere(scope: DailyReportScope, day: string) {
  const window = saleDateWindow(day);
  const onDay = { organizationId: scope.organizationId, saleDate: window, storeId: scope.storeId };
  const completed = { ...onDay, status: "COMPLETED" as const };

  return {
    completed,
    completedWithDue: { ...completed, dueAmount: { gt: 0 } },
    onDay,
    // Every completed sale dated up to the end of this day that still owes.
    outstanding: {
      dueAmount: { gt: 0 },
      organizationId: scope.organizationId,
      saleDate: { lt: window.lt },
      status: "COMPLETED" as const,
      storeId: scope.storeId
    },
    transactions: { ...onDay, status: { in: [...REPORTED_SALE_STATUSES] } }
  };
}

/* -------------------------------------------------------------------------- */
/* The figures                                                                */
/* -------------------------------------------------------------------------- */

export type DailyStatusGroup = {
  count: number;
  status: SaleStatus;
  sums: {
    discount: ReportMoney;
    dueAmount: ReportMoney;
    paidAmount: ReportMoney;
    shipping: ReportMoney;
    subtotal: ReportMoney;
    tax: ReportMoney;
    total: ReportMoney;
  };
};

export type DailyMethodGroup = {
  count: number;
  method: SalePaymentMethod;
  sums: { dueAmount: ReportMoney; paidAmount: ReportMoney; total: ReportMoney };
};

/** What the database adds up, per day — the repository's answer, before any arithmetic. */
export type DailySalesFacts = {
  /** Completed sales of the day, by the method recorded on each. */
  byMethod: DailyMethodGroup[];
  /** Every sale of the day, drafts included, by status. */
  byStatus: DailyStatusGroup[];
  /** Line discounts on the day's completed sales — already out of their subtotals. */
  completedLineDiscount: ReportMoney;
  /** Completed sales of the day that still owe something. */
  completedWithDue: number;
  /** Completed sales dated up to the end of the day that still owe, at today's balances. */
  outstanding: { count: number; dueAmount: ReportMoney };
};

export type DailyStatusFigures = { count: number; paidCents: number; totalCents: number };

export type DailySalesFigures = {
  cancelled: DailyStatusFigures;
  completed: {
    count: number;
    /** Line and sale discounts together. */
    discountCents: number;
    /** Still owed on the day's completed sales, at today's balances. */
    dueCents: number;
    /** Price × quantity on every line, before any discount. */
    grossCents: number;
    lineDiscountCents: number;
    /** Gross less every discount: the goods, before tax and shipping. */
    netCents: number;
    /** Paid amounts recorded on the day's completed sales — what the report calls received. */
    paidCents: number;
    saleDiscountCents: number;
    shippingCents: number;
    taxCents: number;
    /** What the customers were billed: net + tax + shipping. */
    totalCents: number;
    withDueCount: number;
  };
  drafts: { count: number };
  methods: Array<{
    count: number;
    dueCents: number;
    /** The counter's, the list's and the receipt's name for it. */
    label: string;
    method: SalePaymentMethod;
    paidCents: number;
    totalCents: number;
  }>;
  outstanding: {
    count: number;
    /** From sales dated before this day. */
    earlierCents: number;
    /** From this day's own sales — the same figure as `completed.dueCents`. */
    thisDayCents: number;
    totalCents: number;
  };
  returned: DailyStatusFigures;
  /** Completed, returned and cancelled — the rows of the transaction table. */
  transactionCount: number;
};

/**
 * A stored amount in whole cents. Every sum is compared and added as an
 * integer, since 0.1 + 0.2 is not 0.3 and these are a shop's takings.
 */
export function moneyCents(value: ReportMoney): number {
  if (value === null || value === undefined) {
    return 0;
  }

  const text = value.toString().trim();
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(text);

  if (!match) {
    const parsed = Number(text);
    return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
  }

  const cents = Number(match[2]) * 100 + Math.round(Number(`0.${match[3] ?? "0"}`) * 100);

  return match[1] === "-" ? -cents : cents;
}

/** Whole cents, shown the way the counter, the list and the receipt show money. */
export function formatReportMoney(cents: number, currency: string) {
  return formatSaleMoney(cents / 100, currency);
}

export function summarizeDailySales(facts: DailySalesFacts): DailySalesFigures {
  const group = (status: SaleStatus) => facts.byStatus.find((row) => row.status === status);
  const completed = group("COMPLETED");
  const subtotalCents = moneyCents(completed?.sums.subtotal);
  const lineDiscountCents = moneyCents(facts.completedLineDiscount);
  const saleDiscountCents = moneyCents(completed?.sums.discount);
  const dueCents = moneyCents(completed?.sums.dueAmount);
  const outstandingCents = moneyCents(facts.outstanding.dueAmount);
  const returned = statusFigures(group("RETURNED"));
  const cancelled = statusFigures(group("CANCELLED"));
  const completedCount = completed?.count ?? 0;

  return {
    cancelled,
    completed: {
      count: completedCount,
      discountCents: lineDiscountCents + saleDiscountCents,
      dueCents,
      // A line's stored total is its price × quantity less its own discount,
      // so adding the discount back gives the price × quantity.
      grossCents: subtotalCents + lineDiscountCents,
      lineDiscountCents,
      netCents: subtotalCents - saleDiscountCents,
      paidCents: moneyCents(completed?.sums.paidAmount),
      saleDiscountCents,
      shippingCents: moneyCents(completed?.sums.shipping),
      taxCents: moneyCents(completed?.sums.tax),
      totalCents: moneyCents(completed?.sums.total),
      withDueCount: facts.completedWithDue
    },
    drafts: { count: group("DRAFT")?.count ?? 0 },
    methods: DAILY_REPORT_PAYMENT_METHODS.map((method) => {
      const row = facts.byMethod.find((entry) => entry.method === method);

      return {
        count: row?.count ?? 0,
        dueCents: moneyCents(row?.sums.dueAmount),
        label: SALE_PAYMENT_METHOD_LABELS[method],
        method,
        paidCents: moneyCents(row?.sums.paidAmount),
        totalCents: moneyCents(row?.sums.total)
      };
    }),
    outstanding: {
      count: facts.outstanding.count,
      // Two reads a moment apart; a sale settled between them must not make
      // the earlier days owe less than nothing.
      earlierCents: Math.max(outstandingCents - dueCents, 0),
      thisDayCents: dueCents,
      totalCents: outstandingCents
    },
    returned,
    transactionCount: completedCount + returned.count + cancelled.count
  };
}

function statusFigures(row: DailyStatusGroup | undefined): DailyStatusFigures {
  return {
    count: row?.count ?? 0,
    paidCents: moneyCents(row?.sums.paidAmount),
    totalCents: moneyCents(row?.sums.total)
  };
}

/* -------------------------------------------------------------------------- */
/* The transaction table                                                      */
/* -------------------------------------------------------------------------- */

export type DailyReportPagination = {
  all: boolean;
  from: number;
  page: number;
  pageCount: number;
  skip: number;
  take: number;
  to: number;
  total: number;
  /** "Print all" stopped at `DAILY_REPORT_PRINT_LIMIT`. */
  truncated: boolean;
};

export function parseReportPage(value: unknown) {
  const page = Number(Array.isArray(value) ? value[0] : value);

  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** Fifty rows a page; a page past the end shows the last one. */
export function reportPagination(
  total: number,
  requestedPage: number,
  all: boolean
): DailyReportPagination {
  if (all) {
    const take = Math.min(total, DAILY_REPORT_PRINT_LIMIT);

    return {
      all,
      from: take ? 1 : 0,
      page: 1,
      pageCount: 1,
      skip: 0,
      take,
      to: take,
      total,
      truncated: total > take
    };
  }

  const pageCount = Math.max(1, Math.ceil(total / DAILY_REPORT_PAGE_SIZE));
  const page = Math.min(Math.max(1, Math.trunc(requestedPage)), pageCount);
  const skip = (page - 1) * DAILY_REPORT_PAGE_SIZE;
  const to = Math.min(skip + DAILY_REPORT_PAGE_SIZE, total);

  return {
    all,
    from: total ? skip + 1 : 0,
    page,
    pageCount,
    skip,
    take: DAILY_REPORT_PAGE_SIZE,
    to,
    total,
    truncated: false
  };
}

export type DailyTransactionRecord = {
  completedAt: Date | null;
  createdAt: Date;
  customer: { name: string } | null;
  dueAmount: ReportMoney;
  id: string;
  paidAmount: ReportMoney;
  paymentMethod: SalePaymentMethod;
  saleNumber: string;
  status: SaleStatus;
  total: ReportMoney;
};

export type DailyTransactionRow = {
  /** The customer's name, or null for a walk-in. Never their phone or address. */
  customer: string | null;
  dueCents: number;
  id: string;
  method: string;
  number: string;
  paidCents: number;
  status: SaleStatus;
  time: string;
  totalCents: number;
};

/**
 * When the sale happened, as the receipt reads it: completed, or saved if it
 * never was, in the store's timezone. A sale recorded on another day than the
 * one it is dated says which.
 */
export function transactionTime(
  record: { completedAt: Date | null; createdAt: Date },
  day: string,
  timeZone: string
) {
  const moment = record.completedAt ?? record.createdAt;
  const time = new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone }).format(moment);

  if (reportDayInTimeZone(moment, timeZone) === day) {
    return time;
  }

  return `${new Intl.DateTimeFormat("en", { day: "numeric", month: "short", timeZone }).format(moment)}, ${time}`;
}

export function dailyTransactionRow(
  record: DailyTransactionRecord,
  day: string,
  timeZone: string
): DailyTransactionRow {
  return {
    customer: record.customer?.name ?? null,
    dueCents: moneyCents(record.dueAmount),
    id: record.id,
    method: SALE_PAYMENT_METHOD_LABELS[record.paymentMethod],
    number: record.saleNumber,
    paidCents: moneyCents(record.paidAmount),
    status: record.status,
    time: transactionTime(record, day, timeZone),
    totalCents: moneyCents(record.total)
  };
}

/* -------------------------------------------------------------------------- */
/* The report                                                                 */
/* -------------------------------------------------------------------------- */

export type DailySalesReport = {
  currency: string;
  day: string;
  dayLabel: string;
  figures: DailySalesFigures;
  generatedAt: string;
  isFuture: boolean;
  isToday: boolean;
  pagination: DailyReportPagination;
  storeName: string;
  timeZone: string;
  today: string;
  transactions: DailyTransactionRow[];
};

export function buildDailySalesReport(input: {
  currency: string;
  day: string;
  figures: DailySalesFigures;
  now: Date;
  pagination: DailyReportPagination;
  records: DailyTransactionRecord[];
  storeName: string;
  timeZone: string;
  today: string;
}): DailySalesReport {
  return {
    currency: input.currency,
    day: input.day,
    dayLabel: reportDayLabel(input.day),
    figures: input.figures,
    generatedAt: new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: input.timeZone
    }).format(input.now),
    isFuture: input.day > input.today,
    isToday: input.day === input.today,
    pagination: input.pagination,
    storeName: input.storeName,
    timeZone: input.timeZone,
    today: input.today,
    transactions: input.records.map((record) =>
      dailyTransactionRow(record, input.day, input.timeZone)
    )
  };
}

/** A calendar day in words — formatted in UTC because it is a date, not a moment. */
export function reportDayLabel(day: string) {
  const [year, month, date] = dayParts(day);

  return new Intl.DateTimeFormat("en", { dateStyle: "full", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, date))
  );
}

export function dailyReportHref(day: string, options: { all?: boolean; page?: number } = {}) {
  const params = new URLSearchParams({ date: day });

  if (options.all) {
    params.set("all", "1");
  } else if (options.page && options.page > 1) {
    params.set("page", String(options.page));
  }

  return `${DAILY_REPORT_PATH}?${params.toString()}`;
}

/** The sales list, narrowed to one day and one status — where a count on the report leads. */
export function salesListHref(day: string, status: SaleStatus) {
  return `/dashboard/sales?${new URLSearchParams({ dateFrom: day, dateTo: day, status: status.toLowerCase() }).toString()}`;
}

/* -------------------------------------------------------------------------- */
/* Paper                                                                      */
/* -------------------------------------------------------------------------- */

export const DAILY_REPORT_PAPER_CLASS = "storeim-daily-report";
export const DAILY_REPORT_PRINT_ROOT_CLASS = "storeim-daily-report-print";

/**
 * The receipt's pattern: on screen the print copy does not exist; in print it
 * is the only thing that does, so the dashboard feeds no blank pages through.
 */
export function dailyReportPrintRootStylesheet() {
  return `
@media screen {
  .${DAILY_REPORT_PRINT_ROOT_CLASS} { display: none !important; }
}
@media print {
  @page { size: A4; margin: 12mm; }
  html, body {
    background: #fff !important;
    height: auto !important;
    margin: 0 !important;
    min-height: 0 !important;
    overflow: visible !important;
    padding: 0 !important;
  }
  body > *:not(.${DAILY_REPORT_PRINT_ROOT_CLASS}) { display: none !important; }
  .${DAILY_REPORT_PRINT_ROOT_CLASS} { display: block !important; }
}
`;
}

/**
 * Black on white on A4, styled here rather than with Tailwind or in
 * `globals.css` — it is paper, and the dark-mode generator would repaint it.
 */
export function dailyReportPaperStylesheet() {
  const root = `.${DAILY_REPORT_PAPER_CLASS}`;

  return `
${root} {
  background: #fff;
  color: #000;
  font-family: "Segoe UI", "Nirmala UI", "Noto Sans Bengali", "Noto Sans", Vrinda, "Hind Siliguri", Arial, sans-serif;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  line-height: 1.4;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
${root} * { box-sizing: border-box; color: inherit; }
${root} h1 { font-size: 18px; margin: 0; }
${root} h2 { border-bottom: 1.5px solid #000; font-size: 12px; letter-spacing: 0.06em; margin: 6mm 0 2mm; padding-bottom: 1mm; text-transform: uppercase; }
${root} .d-head { display: flex; gap: 6mm; justify-content: space-between; }
${root} .d-meta { text-align: right; }
${root} .d-grid { display: grid; gap: 0 10mm; grid-template-columns: 1fr 1fr; }
${root} .d-row { border-bottom: 1px solid #ddd; display: flex; gap: 4mm; justify-content: space-between; padding: 1mm 0; }
${root} .d-row > span:last-child { text-align: right; white-space: nowrap; }
${root} .d-strong { font-weight: 700; }
${root} .d-note { font-size: 9.5px; margin: 1.5mm 0 0; }
${root} table { border-collapse: collapse; width: 100%; }
${root} th, ${root} td { border-bottom: 1px solid #ccc; padding: 1.2mm 1.5mm; text-align: left; vertical-align: top; }
${root} th { border-bottom: 1.5px solid #000; font-weight: 700; }
${root} td.d-num, ${root} th.d-num { text-align: right; white-space: nowrap; }
${root} tr { break-inside: avoid; }
${root} tfoot td { border-bottom: 0; border-top: 1.5px solid #000; font-weight: 700; }
`;
}

function dayParts(day: string): [number, number, number] {
  const [year = "1970", month = "1", date = "1"] = day.split("-");

  return [Number(year), Number(month), Number(date)];
}
