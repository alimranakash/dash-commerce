/**
 * Daily Sales Report check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * report — without a database. The filters the repository hands to Prisma are
 * built by `dailyReportWhere`; here the same objects are run over an in-memory
 * set of sales by a small evaluator that knows exactly the operators they use
 * (and fails on any other), then added up the way the repository's groupBy and
 * aggregate calls add them up. So what is tested is which sales each figure
 * reads, not only the arithmetic after it.
 *
 * Covers:
 * - business-day boundaries: the store's timezone for "today", and `saleDate`
 *   stored at midnight by servers in different timezones;
 * - partial payments, payment-method totals, discounts, tax and shipping;
 * - returns and voids kept out of sales and received, and drafts out of all;
 * - outstanding balances up to a date, and from earlier days;
 * - store isolation: every filter carries the session's organization and store;
 * - empty dates, pagination, transaction times and the page's own wiring.
 *
 * Run with: npm run verify:daily-sales-report
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildDailySalesReport,
  DAILY_REPORT_PAGE_SIZE,
  DAILY_REPORT_PATH,
  DAILY_REPORT_PAYMENT_METHODS,
  DAILY_REPORT_PRINT_LIMIT,
  dailyReportClock,
  dailyReportHref,
  dailyReportWhere,
  moneyCents,
  parseReportDay,
  parseReportPage,
  reportDayInTimeZone,
  reportPagination,
  saleDateWindow,
  shiftReportDay,
  summarizeDailySales,
  type DailyReportScope,
  type DailySalesFacts,
  type DailyTransactionRecord
} from "../apps/web/src/modules/sales/sale-daily-report";
import {
  salePaymentMethodSchema,
  type SalePaymentMethod,
  type SaleStatus
} from "../apps/web/src/modules/sales/sale.schema";

let failures = 0;

function check(label: string, passed: boolean, detail: unknown = "") {
  if (passed) {
    console.log(`  ok   ${label}`);
    return;
  }

  failures += 1;
  console.log(
    `  FAIL ${label}${detail !== "" ? ` — ${typeof detail === "string" ? detail : JSON.stringify(detail)}` : ""}`
  );
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

/* -------------------------------------------------------------------------- */
/* An in-memory stand-in for the sales table                                   */
/* -------------------------------------------------------------------------- */

type Row = {
  completedAt: Date | null;
  createdAt: Date;
  customer: { name: string; phone: string } | null;
  discount: string;
  dueAmount: string;
  id: string;
  items: Array<{ discount: string; total: string }>;
  organizationId: string;
  paidAmount: string;
  paymentMethod: SalePaymentMethod;
  saleDate: Date;
  saleNumber: string;
  shipping: string;
  status: SaleStatus;
  storeId: string;
  subtotal: string;
  tax: string;
  total: string;
};

/** Prisma's semantics for exactly the operators the report's filters use — and a failure for any other. */
function matches(row: Row, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (!(key in row)) {
      throw new Error(`filter on unknown column ${key}`);
    }

    const value = (row as Record<string, unknown>)[key];

    if (condition === null || typeof condition !== "object" || condition instanceof Date) {
      return value === condition;
    }

    return Object.entries(condition as Record<string, unknown>).every(([operator, operand]) => {
      switch (operator) {
        case "in":
          return (operand as unknown[]).includes(value);
        case "gte":
          return comparable(value) >= comparable(operand);
        case "gt":
          return comparable(value) > comparable(operand);
        case "lt":
          return comparable(value) < comparable(operand);
        default:
          throw new Error(`unsupported operator ${operator} on ${key}`);
      }
    });
  });
}

function comparable(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value * 100;
  return moneyCents(String(value));
}

/** What Postgres hands back for a SUM over numeric(12,2): a Decimal, or null over no rows. */
function decimalSum(values: string[]) {
  if (!values.length) return null;
  const cents = values.reduce((total, value) => total + moneyCents(value), 0);
  // Decimal.js drops trailing zeros: 2090.30 comes back as "2090.3".
  return { toString: () => String(cents / 100) };
}

function groupBy<K extends string>(rows: Row[], key: (row: Row) => K) {
  const groups = new Map<K, Row[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return [...groups.entries()];
}

/** The repository's five reads, over the in-memory rows, from the same filter objects. */
function factsFor(rows: Row[], scope: DailyReportScope, day: string): DailySalesFacts {
  const where = dailyReportWhere(scope, day);
  const onDay = rows.filter((row) => matches(row, where.onDay));
  const completed = rows.filter((row) => matches(row, where.completed));
  const outstanding = rows.filter((row) => matches(row, where.outstanding));
  const sums = (group: Row[]) => ({
    discount: decimalSum(group.map((row) => row.discount)),
    dueAmount: decimalSum(group.map((row) => row.dueAmount)),
    paidAmount: decimalSum(group.map((row) => row.paidAmount)),
    shipping: decimalSum(group.map((row) => row.shipping)),
    subtotal: decimalSum(group.map((row) => row.subtotal)),
    tax: decimalSum(group.map((row) => row.tax)),
    total: decimalSum(group.map((row) => row.total))
  });

  return {
    byMethod: groupBy(completed, (row) => row.paymentMethod).map(([method, group]) => ({
      count: group.length,
      method,
      sums: {
        dueAmount: sums(group).dueAmount,
        paidAmount: sums(group).paidAmount,
        total: sums(group).total
      }
    })),
    byStatus: groupBy(onDay, (row) => row.status).map(([status, group]) => ({
      count: group.length,
      status,
      sums: sums(group)
    })),
    completedLineDiscount: decimalSum(
      completed.flatMap((row) => row.items.map((item) => item.discount))
    ),
    completedWithDue: rows.filter((row) => matches(row, where.completedWithDue)).length,
    outstanding: {
      count: outstanding.length,
      dueAmount: decimalSum(outstanding.map((row) => row.dueAmount))
    }
  };
}

function transactionsFor(
  rows: Row[],
  scope: DailyReportScope,
  day: string,
  page: { skip: number; take: number }
): DailyTransactionRecord[] {
  return (
    rows
      .filter((row) => matches(row, dailyReportWhere(scope, day).transactions))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
      .slice(page.skip, page.skip + page.take)
      // The repository's select: the customer's name and nothing else of theirs.
      .map((row) => ({
        completedAt: row.completedAt,
        createdAt: row.createdAt,
        customer: row.customer ? { name: row.customer.name } : null,
        dueAmount: row.dueAmount,
        id: row.id,
        paidAmount: row.paidAmount,
        paymentMethod: row.paymentMethod,
        saleNumber: row.saleNumber,
        status: row.status,
        total: row.total
      }))
  );
}

/** Midnight of `day` where a server set to `timeZone` runs — what `parseSaleDate` stores there. */
function storedMidnight(day: string, timeZone: string) {
  const [year, month, date] = day.split("-").map(Number) as [number, number, number];
  let guess = Date.UTC(year, month - 1, date);

  // Two passes settle the offset, DST included.
  for (let pass = 0; pass < 2; pass += 1) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        day: "2-digit",
        hour: "2-digit",
        hourCycle: "h23",
        minute: "2-digit",
        month: "2-digit",
        timeZone,
        year: "numeric"
      })
        .formatToParts(new Date(guess))
        .map((part) => [part.type, part.value])
    );
    const shown = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute)
    );
    guess -= shown - Date.UTC(year, month - 1, date);
  }

  return new Date(guess);
}

const D = "2026-10-27";
const A: DailyReportScope = { organizationId: "org_a", storeId: "store_a" };
const B: DailyReportScope = { organizationId: "org_b", storeId: "store_b" };
let serial = 0;

function sale(overrides: Partial<Row> & Pick<Row, "status" | "total">): Row {
  serial += 1;
  const total = overrides.total;

  return {
    completedAt: overrides.status === "COMPLETED" ? new Date("2026-10-27T05:00:00Z") : null,
    createdAt: new Date(Date.UTC(2026, 9, 27, 3, serial)),
    customer: null,
    discount: "0.00",
    dueAmount: "0.00",
    id: `sale_${String(serial).padStart(3, "0")}`,
    items: [{ discount: "0.00", total }],
    organizationId: A.organizationId,
    paidAmount: total,
    paymentMethod: "CASH",
    saleDate: storedMidnight(D, "UTC"),
    saleNumber: `SALE-${String(serial).padStart(6, "0")}`,
    shipping: "0.00",
    storeId: A.storeId,
    subtotal: total,
    tax: "0.00",
    ...overrides
  };
}

const rows: Row[] = [
  // Completed, paid in full: two lines (one with its own discount), a sale discount and tax.
  sale({
    customer: { name: "Rahim Uddin", phone: "01711000001" },
    discount: "40.00",
    items: [
      { discount: "0.00", total: "500.00" },
      { discount: "10.00", total: "90.00" }
    ],
    paidAmount: "580.00",
    status: "COMPLETED",
    subtotal: "590.00",
    tax: "30.00",
    total: "580.00"
  }),
  // Completed, part paid by bKash, with delivery charged.
  sale({
    dueAmount: "560.00",
    paidAmount: "500.00",
    paymentMethod: "BKASH",
    shipping: "60.00",
    status: "COMPLETED",
    subtotal: "1000.00",
    total: "1060.00"
  }),
  // Completed, nothing paid yet.
  sale({ dueAmount: "300.00", paidAmount: "0.00", status: "COMPLETED", total: "300.00" }),
  // Completed by Nagad, in amounts a float would get wrong.
  sale({
    items: [
      { discount: "0.00", total: "0.10" },
      { discount: "0.00", total: "0.20" }
    ],
    paidAmount: "0.30",
    paymentMethod: "NAGAD",
    status: "COMPLETED",
    subtotal: "0.30",
    total: "0.30"
  }),
  // Completed, saved by a server in Dhaka: its midnight is 18:00 UTC the day before.
  sale({ saleDate: storedMidnight(D, "Asia/Dhaka"), status: "COMPLETED", total: "200.00" }),
  // Returned, and cancelled with something paid on it: never sales, never received.
  sale({ status: "RETURNED", total: "450.00" }),
  sale({
    paidAmount: "200.00",
    paymentMethod: "CARD",
    status: "CANCELLED",
    dueAmount: "500.00",
    total: "700.00"
  }),
  // A draft is not a sale yet, even with a deposit on it.
  sale({ dueAmount: "899.00", paidAmount: "100.00", status: "DRAFT", total: "999.00" }),
  // The day before, still owing; and saved by a Dhaka server, paid.
  sale({
    dueAmount: "150.00",
    paidAmount: "0.00",
    saleDate: storedMidnight("2026-10-26", "UTC"),
    status: "COMPLETED",
    total: "150.00"
  }),
  sale({
    saleDate: storedMidnight("2026-10-26", "Asia/Dhaka"),
    status: "COMPLETED",
    total: "80.00"
  }),
  // Cancelled and returned on the day before, with dues that are owed by nobody.
  sale({
    dueAmount: "40.00",
    paidAmount: "0.00",
    saleDate: storedMidnight("2026-10-26", "UTC"),
    status: "CANCELLED",
    total: "40.00"
  }),
  sale({
    dueAmount: "25.00",
    paidAmount: "0.00",
    saleDate: storedMidnight("2026-10-26", "UTC"),
    status: "RETURNED",
    total: "25.00"
  }),
  // The day after, owing: not outstanding as of the 27th.
  sale({
    dueAmount: "75.00",
    paidAmount: "0.00",
    saleDate: storedMidnight("2026-10-28", "UTC"),
    status: "COMPLETED",
    total: "75.00"
  }),
  // Another shop on the same day, and a row that names this store under another organization.
  sale({
    customer: { name: "Other Shop Customer", phone: "01999000000" },
    organizationId: B.organizationId,
    status: "COMPLETED",
    storeId: B.storeId,
    total: "5000.00"
  }),
  sale({
    organizationId: B.organizationId,
    status: "COMPLETED",
    storeId: A.storeId,
    total: "3000.00"
  })
];

const clock = { now: new Date("2026-10-27T12:00:00Z"), timeZone: "Asia/Dhaka", today: D };
const facts = factsFor(rows, A, D);
const figures = summarizeDailySales(facts);
const cents = (value: number) => Math.round(value * 100);

/* -------------------------------------------------------------------------- */

section("1. The business day, in the store's timezone");
{
  check(
    "a real date is accepted",
    parseReportDay("2026-10-27") === "2026-10-27" &&
      parseReportDay([" 2026-10-27 "]) === "2026-10-27"
  );
  check(
    "…and anything else is refused, not guessed",
    ["2026-02-30", "2026-13-01", "2026-1-5", "27/10/2026", "", "today", "1969-12-31"].every(
      (value) => parseReportDay(value) === null
    ) &&
      parseReportDay(undefined) === null &&
      parseReportDay(20261027) === null
  );
  check(
    "a leap day is a real date",
    parseReportDay("2028-02-29") === "2028-02-29" && parseReportDay("2026-02-29") === null
  );
  check(
    "23:59 in Dhaka is still the 27th",
    dailyReportClock("Asia/Dhaka", new Date("2026-10-27T17:59:59Z")).today === "2026-10-27"
  );
  check(
    "00:00 in Dhaka is the 28th — six hours before UTC gets there",
    dailyReportClock("Asia/Dhaka", new Date("2026-10-27T18:00:00Z")).today === "2026-10-28"
  );
  check(
    "a store on UTC is still on the 27th at that moment",
    dailyReportClock("UTC", new Date("2026-10-27T18:00:00Z")).today === "2026-10-27"
  );
  check(
    "an unusable or missing timezone falls back to the receipt's (Asia/Dhaka)",
    dailyReportClock("Mars/Olympus", new Date("2026-10-27T18:00:00Z")).timeZone === "Asia/Dhaka" &&
      dailyReportClock("", new Date("2026-10-27T18:00:00Z")).today === "2026-10-28"
  );
  check(
    "previous and next day cross months, years and leap days",
    shiftReportDay("2026-03-01", -1) === "2026-02-28" &&
      shiftReportDay("2028-03-01", -1) === "2028-02-29" &&
      shiftReportDay("2026-12-31", 1) === "2027-01-01"
  );
}

section("2. A sale's date is found wherever the server that saved it runs");
{
  const zones = [
    "UTC",
    "Asia/Dhaka",
    "Asia/Kathmandu",
    "Asia/Kolkata",
    "Europe/London",
    "America/Los_Angeles",
    "Pacific/Honolulu",
    "Pacific/Fiji"
  ];
  const inside = (moment: Date, day: string) => {
    const window = saleDateWindow(day);
    return moment >= window.gte && moment < window.lt;
  };

  for (const zone of zones) {
    const midnight = storedMidnight(D, zone);
    check(
      `midnight of the 27th saved in ${zone} is the 27th, and not the 26th or 28th`,
      inside(midnight, D) && !inside(midnight, "2026-10-26") && !inside(midnight, "2026-10-28"),
      midnight.toISOString()
    );
  }

  const parsed = new Date(`${D}T00:00:00`);
  check(
    `what parseSaleDate stores in this process's own timezone is found too (${parsed.toISOString()})`,
    inside(parsed, D)
  );
  const windows = ["2026-10-26", D, "2026-10-28"].map(saleDateWindow);
  check(
    "consecutive days' windows meet exactly, with no gap and no overlap",
    windows[0]!.lt.getTime() === windows[1]!.gte.getTime() &&
      windows[1]!.lt.getTime() === windows[2]!.gte.getTime()
  );
  check(
    "the sale saved by a Dhaka server (18:00 UTC on the 26th) is in the 27th's figures",
    figures.completed.count === 5
  );
}

section("3. Sold: completed sales only, with gross, discounts and net as the sale stores them");
{
  const c = figures.completed;
  check("5 completed sales", c.count === 5, c.count);
  check(
    "gross = price × quantity before any discount = 2,100.30",
    c.grossCents === cents(2100.3),
    c.grossCents
  );
  check(
    "line discounts 10.00 and sale discounts 40.00 make 50.00",
    c.lineDiscountCents === 1000 && c.saleDiscountCents === 4000 && c.discountCents === 5000
  );
  check(
    "net = gross − discounts = 2,050.30",
    c.netCents === cents(2050.3) && c.netCents === c.grossCents - c.discountCents
  );
  check("tax 30.00 and shipping 60.00", c.taxCents === 3000 && c.shippingCents === 6000);
  check(
    "total billed = net + tax + shipping = 2,140.30, exactly the stored totals",
    c.totalCents === cents(2140.3) && c.totalCents === c.netCents + c.taxCents + c.shippingCents
  );
  check(
    "0.10 + 0.20 is counted as 0.30, not 0.30000000000000004",
    rows[3]!.total === "0.30" && c.totalCents % 1 === 0
  );
}

section("4. Received, partial payments and what is still due");
{
  const c = figures.completed;
  check(
    "received = paid amounts on the completed sales = 1,280.30",
    c.paidCents === cents(1280.3),
    c.paidCents
  );
  check("an unpaid sale adds nothing to received", c.paidCents === 58000 + 50000 + 0 + 30 + 20000);
  check(
    "a part-paid sale adds what was paid (500.00 of 1,060.00) and leaves 560.00 due",
    figures.methods.find((row) => row.method === "BKASH")?.paidCents === 50000
  );
  check(
    "still due from the day = 860.00, on 2 sales",
    c.dueCents === 86000 && c.withDueCount === 2
  );
  check("received + due = billed", c.paidCents + c.dueCents === c.totalCents);
  check(
    "a draft's deposit is not received",
    !figures.methods.some((row) => row.paidCents === 10000) && c.paidCents === cents(1280.3)
  );
}

section("5. Payment-method totals");
{
  const by = Object.fromEntries(figures.methods.map((row) => [row.method, row]));
  check(
    "every method the sale form offers is listed, in a fixed order",
    DAILY_REPORT_PAYMENT_METHODS.join() === figures.methods.map((row) => row.method).join()
  );
  check(
    "…and the list is exactly the schema's methods — none dropped, none invented",
    [...DAILY_REPORT_PAYMENT_METHODS].sort().join() ===
      [...salePaymentMethodSchema.options].sort().join()
  );
  check(
    "cash: 3 sales, billed 1,080.00, received 780.00, due 300.00",
    by.CASH?.count === 3 &&
      by.CASH.totalCents === 108000 &&
      by.CASH.paidCents === 78000 &&
      by.CASH.dueCents === 30000,
    by.CASH
  );
  check(
    "bKash: 1 sale, 1,060.00 billed, 500.00 received, 560.00 due",
    by.BKASH?.count === 1 && by.BKASH.totalCents === 106000 && by.BKASH.dueCents === 56000
  );
  check("Nagad: 0.30 received", by.NAGAD?.paidCents === 30);
  check(
    "card shows nothing: its only sale was cancelled",
    by.CARD?.count === 0 && by.CARD.paidCents === 0
  );
  check(
    "methods with no sales are shown at zero, not left out",
    by.BANK?.count === 0 && by.COD?.count === 0 && by.OTHER?.count === 0
  );
  check("labels are the counter's own", by.BKASH?.label === "bKash" && by.CASH?.label === "Cash");
  const sum = (key: "count" | "dueCents" | "paidCents" | "totalCents") =>
    figures.methods.reduce((total, row) => total + row[key], 0);
  check(
    "the methods add up to the day: count, billed, received and due",
    sum("count") === figures.completed.count &&
      sum("totalCents") === figures.completed.totalCents &&
      sum("paidCents") === figures.completed.paidCents &&
      sum("dueCents") === figures.completed.dueCents
  );
}

section("6. Returns and voids are their own figures, never sales or negative sales");
{
  check(
    "1 returned sale of 450.00, with 450.00 paid on it before",
    figures.returned.count === 1 &&
      figures.returned.totalCents === 45000 &&
      figures.returned.paidCents === 45000
  );
  check(
    "1 cancelled sale of 700.00, with 200.00 recorded as paid",
    figures.cancelled.count === 1 &&
      figures.cancelled.totalCents === 70000 &&
      figures.cancelled.paidCents === 20000
  );
  check(
    "neither is in sold, received or any payment method",
    figures.completed.totalCents === cents(2140.3) &&
      figures.completed.paidCents === cents(1280.3) &&
      figures.methods.reduce((t, r) => t + r.count, 0) === 5
  );
  check("nothing is negative anywhere", JSON.stringify(figures).match(/-\d/) === null);
  check(
    "a draft is counted in nothing but its own note",
    figures.drafts.count === 1 && figures.transactionCount === 7
  );
}

section("7. Outstanding up to the date, and from earlier days");
{
  const o = figures.outstanding;
  check(
    "completed sales dated on or before the 27th that still owe: 560 + 300 + 150 = 1,010.00 on 3 sales",
    o.totalCents === 101000 && o.count === 3,
    o
  );
  check(
    "from the day itself 860.00, from earlier days 150.00",
    o.thisDayCents === 86000 && o.earlierCents === 15000
  );
  check(
    "a sale dated the 28th is not owed as of the 27th",
    !rows.some(
      (row) => row.dueAmount === "75.00" && matches(row, dailyReportWhere(A, D).outstanding)
    )
  );
  check("cancelled and returned dues are owed by nobody", o.totalCents === 101000);
  const later = summarizeDailySales(factsFor(rows, A, "2026-10-30")).outstanding;
  check(
    "by the 30th the 28th's 75.00 is outstanding too (1,085.00)",
    later.totalCents === 108500 && later.earlierCents === 108500 && later.thisDayCents === 0
  );
  const raced = summarizeDailySales({
    ...facts,
    outstanding: { count: 1, dueAmount: { toString: () => "100" } }
  }).outstanding;
  check(
    "a sale settled between two reads never makes earlier days owe less than nothing",
    raced.earlierCents === 0
  );
}

section("8. Store isolation");
{
  const where = dailyReportWhere(A, D);
  check(
    "every filter carries this organization and this store",
    Object.values(where).every(
      (clause) => clause.organizationId === A.organizationId && clause.storeId === A.storeId
    ),
    Object.keys(where)
  );
  const seen = transactionsFor(rows, A, D, { skip: 0, take: 100 });
  check(
    "another shop's sale on the same day is not in this shop's rows",
    !seen.some((row) => row.total === "5000.00")
  );
  check(
    "…nor a row under this store id but another organization",
    !seen.some((row) => row.total === "3000.00")
  );
  check("…nor in any total", figures.completed.totalCents === cents(2140.3));
  const other = summarizeDailySales(factsFor(rows, B, D));
  check(
    "the other shop sees only its own sale",
    other.completed.count === 1 &&
      other.completed.totalCents === 500000 &&
      other.outstanding.totalCents === 0
  );
  check(
    "the rows carry a customer's name and never their phone",
    seen.every((row) => !row.customer || Object.keys(row.customer).join() === "name")
  );

  const repository = read("apps/web/src/modules/sales/sale.repository.ts");
  const report = repository.slice(
    repository.indexOf("export async function getDailySalesFacts("),
    repository.indexOf("export async function countSalesForStore(")
  );
  check(
    "the repository runs those same filters: by status over the day, by method and line discounts over completed",
    report.includes("const where = dailyReportWhere(scope, day);") &&
      report.includes("where: where.onDay") &&
      (report.match(/where: where\.completed\b(?!WithDue)/g) ?? []).length === 1 &&
      report.includes("sale: where.completed") &&
      report.includes("where: where.completedWithDue") &&
      report.includes("where: where.outstanding") &&
      report.includes("where: dailyReportWhere(scope, day).transactions")
  );
  check(
    "…and selects only the customer's name",
    /customer: \{\s*select: \{\s*name: true\s*\}\s*\}/.test(report) &&
      !/phone|email|address/i.test(report)
  );
  check(
    "…and writes nothing",
    !/\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(|\$executeRaw|\$transaction/.test(
      report
    )
  );

  const page = read("apps/web/src/app/dashboard/sales/daily-report/page.tsx");
  check(
    "the page resolves the store from the session",
    page.includes("const store = await requireStore();")
  );
  check(
    "…and hands the service that store's own ids",
    page.includes("id: store.id") && page.includes("organizationId: store.organizationId")
  );
  check(
    "…reading only the date, the page and print-all from the address",
    (page.match(/params\.(\w+)/g) ?? []).every((use) =>
      ["params.date", "params.page", "params.all"].includes(use)
    )
  );
  const service = read("apps/web/src/modules/sales/sale-daily-report.service.ts");
  check(
    "the service scopes by the store it is handed",
    service.includes("const scope = { organizationId: store.organizationId, storeId: store.id };")
  );
}

section("9. An empty date");
{
  const empty = summarizeDailySales(factsFor(rows, A, "2026-10-29"));
  check(
    "no sales: every day figure is zero",
    empty.transactionCount === 0 &&
      empty.completed.count === 0 &&
      empty.completed.totalCents === 0 &&
      empty.completed.paidCents === 0 &&
      empty.returned.count === 0 &&
      empty.cancelled.count === 0
  );
  check(
    "every payment method still listed, at zero",
    empty.methods.length === DAILY_REPORT_PAYMENT_METHODS.length &&
      empty.methods.every((row) => row.count === 0 && row.paidCents === 0)
  );
  check(
    "what earlier days still owe is still reported",
    empty.outstanding.totalCents === 108500 && empty.outstanding.thisDayCents === 0
  );
  const pagination = reportPagination(0, 1, false);
  check(
    "the table is empty, page 1 of 1, from 0 to 0",
    pagination.from === 0 && pagination.to === 0 && pagination.pageCount === 1
  );
  const service = read("apps/web/src/modules/sales/sale-daily-report.service.ts");
  check(
    "no rows are read for an empty day",
    service.includes("pagination.take > 0 && pagination.total > 0")
  );
  const facts = {
    byMethod: [],
    byStatus: [],
    completedLineDiscount: null,
    completedWithDue: 0,
    outstanding: { count: 0, dueAmount: null }
  };
  const nothing = summarizeDailySales(facts);
  check(
    "Postgres's null sums over no rows read as zero",
    nothing.completed.grossCents === 0 && nothing.outstanding.totalCents === 0
  );
}

section("10. Money in whole cents");
{
  check("a Decimal without trailing zeros", moneyCents({ toString: () => "2090.3" }) === 209030);
  check(
    "two places, none, and a negative",
    moneyCents("12.05") === 1205 && moneyCents("7") === 700 && moneyCents("-5.5") === -550
  );
  check("null and undefined are zero", moneyCents(null) === 0 && moneyCents(undefined) === 0);
  check("exponent notation is still read", moneyCents("1e3") === 100000);
}

section("11. The transaction table");
{
  const records = transactionsFor(rows, A, D, { skip: 0, take: 50 });
  const report = buildDailySalesReport({
    ...clock,
    currency: "BDT",
    day: D,
    figures,
    pagination: reportPagination(figures.transactionCount, 1, false),
    records,
    storeName: "Worzen"
  });
  check(
    "completed, returned and cancelled sales of the day, drafts left out: 7 rows",
    report.transactions.length === 7 && !report.transactions.some((row) => row.status === "DRAFT")
  );
  check(
    "oldest first",
    report.transactions.map((row) => row.number).join() ===
      [...report.transactions.map((row) => row.number)].sort().join()
  );
  check(
    "a walk-in has no customer; a customer is named",
    report.transactions[0]?.customer === "Rahim Uddin" && report.transactions[1]?.customer === null
  );
  check(
    "amounts are the sale's stored ones",
    report.transactions[1]?.totalCents === 106000 &&
      report.transactions[1]?.paidCents === 50000 &&
      report.transactions[1]?.dueCents === 56000
  );
  check("the payment method is the counter's label", report.transactions[1]?.method === "bKash");
  check(
    "the time is the store's: 05:00 UTC is 11:00 AM in Dhaka",
    report.transactions[0]?.time === "11:00 AM",
    report.transactions[0]?.time
  );
  const lateSaved = buildDailySalesReport({
    ...clock,
    currency: "BDT",
    day: D,
    figures,
    pagination: reportPagination(1, 1, false),
    records: [{ ...records[0]!, completedAt: new Date("2026-10-27T18:15:00Z") }],
    storeName: "Worzen"
  });
  check(
    "a sale dated the 27th but completed at 00:15 on the 28th in Dhaka says so",
    lateSaved.transactions[0]?.time === "Oct 28, 12:15 AM",
    lateSaved.transactions[0]?.time
  );
  const lateEvening = buildDailySalesReport({
    ...clock,
    currency: "BDT",
    day: D,
    figures,
    pagination: reportPagination(1, 1, false),
    records: [{ ...records[0]!, completedAt: new Date("2026-10-27T17:30:00Z") }],
    storeName: "Worzen"
  });
  check(
    "23:30 in Dhaka is still the 27th — no UTC date shift",
    lateEvening.transactions[0]?.time === "11:30 PM",
    lateEvening.transactions[0]?.time
  );
  const unfinished = buildDailySalesReport({
    ...clock,
    currency: "BDT",
    day: D,
    figures,
    pagination: reportPagination(1, 1, false),
    records: [{ ...records[0]!, completedAt: null }],
    storeName: "Worzen"
  });
  check(
    "a sale never completed is timed when it was saved, as the receipt does",
    unfinished.transactions[0]?.time ===
      new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone: "Asia/Dhaka" }).format(
        records[0]!.createdAt
      )
  );
  check("the day reads in words", report.dayLabel === "Tuesday, October 27, 2026");
  check(
    "today, not the future",
    report.isToday &&
      !report.isFuture &&
      buildDailySalesReport({
        ...clock,
        currency: "BDT",
        day: "2026-10-30",
        figures,
        pagination: reportPagination(0, 1, false),
        records: [],
        storeName: "W"
      }).isFuture
  );
  check(
    "printed in the store's timezone",
    report.generatedAt.includes("6:00 PM"),
    report.generatedAt
  );
}

section("12. Pagination");
{
  check(
    "50 rows are one page; 51 are two",
    reportPagination(50, 1, false).pageCount === 1 && reportPagination(51, 1, false).pageCount === 2
  );
  const second = reportPagination(51, 2, false);
  check(
    "page 2 of 51 skips 50 and shows row 51",
    second.skip === DAILY_REPORT_PAGE_SIZE && second.from === 51 && second.to === 51
  );
  check(
    "a page past the end shows the last page",
    reportPagination(120, 99, false).page === 3 && reportPagination(120, 99, false).from === 101
  );
  check(
    "a page that is not a number is page 1",
    parseReportPage("abc") === 1 &&
      parseReportPage("0") === 1 &&
      parseReportPage(["2"]) === 2 &&
      parseReportPage("2.5") === 1
  );
  const all = reportPagination(1500, 3, true);
  check(
    `print-all reads every row up to ${DAILY_REPORT_PRINT_LIMIT}, and says when it stopped`,
    all.take === DAILY_REPORT_PRINT_LIMIT &&
      all.truncated &&
      !reportPagination(70, 1, true).truncated &&
      reportPagination(70, 1, true).take === 70
  );
  check(
    "links carry the date, and page or all",
    dailyReportHref(D) === `${DAILY_REPORT_PATH}?date=${D}` &&
      dailyReportHref(D, { page: 2 }) === `${DAILY_REPORT_PATH}?date=${D}&page=2` &&
      dailyReportHref(D, { all: true }) === `${DAILY_REPORT_PATH}?date=${D}&all=1`
  );
  check(
    "the transaction query takes the page it is given",
    transactionsFor(rows, A, D, { skip: 5, take: 50 }).length === 2
  );
}

section("13. The page: states, print, navigation");
{
  const page = read("apps/web/src/app/dashboard/sales/daily-report/page.tsx");
  const view = read("apps/web/src/modules/sales/components/daily-sales-report.tsx");
  const print = read("apps/web/src/modules/sales/components/daily-sales-report-print.tsx");
  check(
    "loading: a skeleton while the day is read, keyed so a new date shows it again",
    /<Suspense\s+fallback=\{<DailySalesReportSkeleton \/>\}\s+key=\{`\$\{day\}:\$\{page\}:\$\{all \? "all" : ""\}`\}\s*>/.test(
      page
    )
  );
  check(
    "an invalid date is an error state, not a guess",
    page.includes("parseReportDay(asked)") && page.includes('title="That isn\'t a valid date"')
  );
  check(
    "a failed read is an error state, with the reason logged and not shown",
    view.includes("console.error(`[sales] daily report failed: ${errorForLog(error)}`);") &&
      view.includes('title="The report could not be loaded"')
  );
  check("an empty day says so", view.includes("No sales on {report.dayLabel}"));
  check(
    "Print and Save as PDF open the browser's dialog over a copy portalled under <body>",
    print.includes("window.print()") &&
      print.includes("createPortal(") &&
      print.includes("document.body")
  );
  check(
    "the paper is styled in the module, never with Tailwind colours or in globals.css",
    !/(?:bg|text|border)-\[#/.test(print) &&
      !read("apps/web/src/app/globals.css").includes("storeim-daily-report")
  );
  check("the date picker cannot pick past today", view.includes("max={today}"));
  check(
    "the sales list links to the report",
    read("apps/web/src/modules/sales/components/sale-list.tsx").includes("href={DAILY_REPORT_PATH}")
  );
  check(
    "the definitions are on the page",
    view.includes("How these figures are worked out") &&
      view.includes("a balance paid on a later day is counted on the day of the sale")
  );
}

const sample = buildDailySalesReport({
  ...clock,
  currency: "BDT",
  day: D,
  figures,
  pagination: reportPagination(7, 1, false),
  records: [],
  storeName: "W"
});
check(
  "(the report's dates are the store's, not the server's)",
  reportDayInTimeZone(clock.now, sample.timeZone) === D
);

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
process.exit(failures === 0 ? 0 : 1);
