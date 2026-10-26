import { maskPhone } from "../ai/ai-redact";
import { formatSaleMoney } from "./sale-scan";
import type { SalePaymentMethod, SalePaymentStatus, SaleStatus, SaleType } from "./sale.schema";

/**
 * A sale as its customer takes it home.
 *
 * The receipt is a *view* of the saved sale, never a second record: there is
 * no invoice table, no receipt counter and no payment row behind it. Its
 * number is the sale's own `saleNumber`; every amount is the one the sale
 * stored when it was saved — nothing is added up again here, so a receipt can
 * never disagree with the sale page — and reading it writes nothing, so ten
 * prints are ten copies of one sale. A sale edited since prints as it now
 * stands, and a draft, a void or a return says so in words a customer cannot
 * mistake for a paid receipt.
 *
 * It is a sales receipt and says so: the store holds no VAT registration to
 * print, so it is never titled an invoice. The sale's notes are internal and
 * never printed, the customer's number is masked as everywhere else a phone
 * leaves the dashboard, and the store's return policy is not invented — there
 * is no such setting to print.
 *
 * Pure, so `verify-sale-receipt` can read whole receipts without a database.
 */

type Money = { toString(): string };

export type ReceiptSaleRecord = {
  completedAt: Date | null;
  createdAt: Date;
  customer: { name: string; phone: string | null } | null;
  discount: Money;
  dueAmount: Money;
  items: ReadonlyArray<{
    discount: Money;
    id: string;
    productName: string;
    quantity: number;
    total: Money;
    unitPrice: Money;
  }>;
  paidAmount: Money;
  paymentMethod: SalePaymentMethod;
  paymentStatus: SalePaymentStatus;
  saleDate: Date;
  saleNumber: string;
  saleType: SaleType;
  shipping: Money;
  status: SaleStatus;
  subtotal: Money;
  tax: Money;
  total: Money;
};

export type ReceiptStoreRecord = { currency: string; name: string; timezone: string };

export type ReceiptStoreSettings =
  | {
      businessAddress?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      logoUrl?: string | null;
      supportPhone?: string | null;
    }
  | null
  | undefined;

export type ReceiptStatusKind = "cancelled" | "completed" | "draft" | "returned";

export type SaleReceiptLine = {
  /** The line's own discount, when it had one. */
  discount: string | null;
  key: string;
  /** As sold — a variant line carries its option, "Shirt - Black / M". */
  name: string;
  quantity: number;
  total: string;
  unitPrice: string;
};

export type SaleReceiptView = {
  customer: { name: string; phone: string | null } | null;
  footer: { disclaimer: string; thanks: string[] };
  /** The total quantity, the figure a customer counts against the bag. */
  itemCount: number;
  issued: { date: string; recorded: string | null };
  lines: SaleReceiptLine[];
  payment: { due: string | null; method: string; paid: string; status: string };
  receiptNumber: string;
  /** "Online sale" for an online one; a counter sale needs no label. */
  saleTypeLabel: string | null;
  status: { kind: ReceiptStatusKind; notice: string | null; title: string };
  store: {
    addressLines: string[];
    email: string | null;
    logoUrl: string | null;
    name: string;
    phone: string | null;
  };
  totals: {
    discount: string | null;
    shipping: string | null;
    subtotal: string;
    tax: string | null;
    total: string;
  };
};

/** What the sale form offers, so the counter, the list and the receipt agree on "bKash". */
export const SALE_PAYMENT_METHOD_LABELS: Record<SalePaymentMethod, string> = {
  BANK: "Bank",
  BKASH: "bKash",
  CARD: "Card",
  CASH: "Cash",
  COD: "COD",
  NAGAD: "Nagad",
  OTHER: "Other"
};

const PAYMENT_STATUS_LABELS: Record<SalePaymentStatus, string> = {
  PARTIAL: "Partially paid",
  PAID: "Paid in full",
  UNPAID: "Unpaid"
};

const RECEIPT_STATUS: Record<SaleStatus, SaleReceiptView["status"]> = {
  CANCELLED: {
    kind: "cancelled",
    notice: "Void — this sale was cancelled. Not a valid receipt.",
    title: "Void sale"
  },
  COMPLETED: { kind: "completed", notice: null, title: "Sales receipt" },
  DRAFT: {
    kind: "draft",
    notice: "Draft — this sale is not completed. Not a receipt for payment.",
    title: "Draft sale"
  },
  RETURNED: {
    kind: "returned",
    notice: "Returned — the items on this sale were returned.",
    title: "Returned sale"
  }
};

/**
 * The platform's floor when a store's own timezone is unusable, the same one
 * admin timestamps fall back to: the deployed server's clock is UTC, six hours
 * behind the shop the receipt is printed in.
 */
export const RECEIPT_FALLBACK_TIME_ZONE = "Asia/Dhaka";

export function receiptTimeZone(value: string | null | undefined) {
  const candidate = value?.trim();

  if (!candidate) {
    return RECEIPT_FALLBACK_TIME_ZONE;
  }

  try {
    new Intl.DateTimeFormat("en", { timeZone: candidate });
    return candidate;
  } catch {
    return RECEIPT_FALLBACK_TIME_ZONE;
  }
}

export function buildSaleReceipt(
  sale: ReceiptSaleRecord,
  store: ReceiptStoreRecord,
  settings: ReceiptStoreSettings
): SaleReceiptView {
  const money = (value: Money) => formatSaleMoney(Number(value.toString()), store.currency);
  const ifPositive = (value: Money) => (Number(value.toString()) > 0 ? money(value) : null);
  const phone = maskPhone(sale.customer?.phone);

  return {
    customer: sale.customer ? { name: sale.customer.name.trim() || "Customer", phone: phone || null } : null,
    footer: {
      disclaimer: "This is a sales receipt, not a tax invoice.",
      thanks: ["Thank you for shopping with us!", "আবার আসবেন।"]
    },
    itemCount: sale.items.reduce((count, item) => count + item.quantity, 0),
    issued: issuedAt(sale, receiptTimeZone(store.timezone)),
    lines: sale.items.map((item) => ({
      discount: ifPositive(item.discount),
      key: item.id,
      name: item.productName,
      quantity: item.quantity,
      total: money(item.total),
      unitPrice: money(item.unitPrice)
    })),
    payment: {
      due: ifPositive(sale.dueAmount),
      method: SALE_PAYMENT_METHOD_LABELS[sale.paymentMethod],
      paid: money(sale.paidAmount),
      status: PAYMENT_STATUS_LABELS[sale.paymentStatus]
    },
    receiptNumber: sale.saleNumber,
    saleTypeLabel: sale.saleType === "ONLINE" ? "Online sale" : null,
    status: RECEIPT_STATUS[sale.status],
    store: {
      addressLines: (settings?.businessAddress ?? "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
      email: settings?.contactEmail?.trim() || null,
      logoUrl: settings?.logoUrl?.trim() || null,
      name: store.name,
      phone: settings?.contactPhone?.trim() || settings?.supportPhone?.trim() || null
    },
    totals: {
      discount: ifPositive(sale.discount),
      shipping: ifPositive(sale.shipping),
      subtotal: money(sale.subtotal),
      tax: ifPositive(sale.tax),
      total: money(sale.total)
    }
  };
}

/**
 * The sale's date, and the time it was rung up when that was the same day.
 *
 * `saleDate` is a calendar day the cashier picked, parsed at the server's own
 * midnight, so it is formatted the way the sale page formats it. The time is a
 * real instant — when the sale was completed, or saved if it never was — and
 * is shown in the store's timezone. A sale entered later for an earlier day
 * keeps its own date and says when it was recorded, rather than pairing the
 * day it happened with an hour from another day.
 */
function issuedAt(sale: ReceiptSaleRecord, timeZone: string): SaleReceiptView["issued"] {
  const moment = sale.completedAt ?? sale.createdAt;
  const day = new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(sale.saleDate);

  if (calendarDay(sale.saleDate) === calendarDay(moment, timeZone)) {
    return {
      date: `${day}, ${new Intl.DateTimeFormat("en", { timeStyle: "short", timeZone }).format(moment)}`,
      recorded: null
    };
  }

  return {
    date: day,
    recorded: new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short", timeZone }).format(moment)
  };
}

function calendarDay(value: Date, timeZone?: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(timeZone ? { timeZone } : {})
  }).format(value);
}

/** Where a sale's receipt lives; `completed` adds the success banner, `print` opens the dialog once. */
export function receiptHref(saleId: string, options: { completed?: boolean; print?: boolean } = {}) {
  const query = new URLSearchParams();

  if (options.completed) {
    query.set("completed", "1");
  }

  if (options.print) {
    query.set("print", "1");
  }

  const search = query.toString();

  return `/dashboard/sales/${encodeURIComponent(saleId)}/receipt${search ? `?${search}` : ""}`;
}

/*
 * Paper.
 *
 * Which paper is in the printer beside *this* till is a fact about the device,
 * not the store, so it is kept in the browser — as the barcode label stock is.
 * A roll is printed one receipt to one page whose height is the receipt's own,
 * so the printer feeds what was printed and no more; A4 is an ordinary page.
 */

export const RECEIPT_PAPER_IDS = ["58mm", "80mm", "a4"] as const;

export type ReceiptPaper = (typeof RECEIPT_PAPER_IDS)[number];

export const DEFAULT_RECEIPT_PAPER: ReceiptPaper = "80mm";

export const RECEIPT_PAPER_STORAGE_KEY = "storeim.receipt.paper";

export const RECEIPT_PAPERS: Record<ReceiptPaper, { label: string; roll: boolean; widthMm: number }> = {
  "58mm": { label: "58 mm", roll: true, widthMm: 58 },
  "80mm": { label: "80 mm", roll: true, widthMm: 80 },
  a4: { label: "A4", roll: false, widthMm: 210 }
};

export function parseReceiptPaper(value: unknown): ReceiptPaper {
  return RECEIPT_PAPER_IDS.find((paper) => paper === value) ?? DEFAULT_RECEIPT_PAPER;
}

/** CSS pixels to millimetres — CSS fixes both at 96 to the inch on screen and on paper. */
export function pxToMm(px: number) {
  return (px * 25.4) / 96;
}

/**
 * The `@page` rule for one print. A roll's page is its width by the receipt's
 * measured height, plus a little for the cutter; without a measurement the
 * height is left to the printer's own paper setting rather than guessed. A4
 * has no margin of its own — the receipt carries its own padding — so the
 * browser has no margin to print its URL and date headers into.
 */
export function receiptPageRule(paper: ReceiptPaper, contentHeightMm: number | null) {
  if (!RECEIPT_PAPERS[paper].roll) {
    return "@page { size: A4; margin: 0; }";
  }

  const width = RECEIPT_PAPERS[paper].widthMm;

  return contentHeightMm && contentHeightMm > 0
    ? `@page { size: ${width}mm ${Math.ceil(contentHeightMm) + 2}mm; margin: 0; }`
    : "@page { margin: 0; }";
}

export const RECEIPT_CLASS = "storeim-receipt";
export const RECEIPT_PRINT_ROOT_CLASS = "storeim-receipt-print";

/**
 * Screen: the print copy does not exist. Print: it is the only thing that
 * does — the dashboard, its sidebar and every dialog are taken out of the
 * flow, not merely hidden, so no blank space is fed through the printer.
 */
export function receiptPrintRootStylesheet() {
  return `
@media screen {
  .${RECEIPT_PRINT_ROOT_CLASS} { display: none !important; }
}
@media print {
  html, body {
    background: #fff !important;
    height: auto !important;
    margin: 0 !important;
    min-height: 0 !important;
    overflow: visible !important;
    padding: 0 !important;
  }
  body > *:not(.${RECEIPT_PRINT_ROOT_CLASS}) { display: none !important; }
  .${RECEIPT_PRINT_ROOT_CLASS} { display: block !important; }
}
`;
}

/**
 * The receipt itself, the same on screen as on paper so the preview is the
 * print. Black on white throughout — a thermal head prints black or nothing,
 * and grey text comes out as dither — with the logo greyed for the same
 * reason. Long names wrap anywhere, amounts never wrap and stay right-aligned
 * on tabular figures, and an item is never split across two pages. The font
 * stack reaches a Bengali face on every desktop a counter runs (Nirmala UI on
 * Windows, Noto or Vrinda elsewhere) before falling back.
 *
 * Kept out of `globals.css` on purpose: it is paper, and the dark-mode
 * generator would otherwise repaint it.
 */
export function receiptStylesheet() {
  const root = `.${RECEIPT_CLASS}`;

  return `
${root} {
  background: #fff;
  box-sizing: border-box;
  color: #000;
  font-family: "Segoe UI", "Nirmala UI", "Noto Sans Bengali", "Noto Sans", Vrinda, "Hind Siliguri", Arial, sans-serif;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  line-height: 1.35;
  overflow-wrap: anywhere;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  text-align: left;
}
${root} * { box-sizing: border-box; color: inherit; }
${root}[data-paper="58mm"] { font-size: 11px; padding: 3mm 5mm 6mm; width: 58mm; }
${root}[data-paper="80mm"] { font-size: 12px; padding: 4mm 4mm 7mm; width: 80mm; }
${root}[data-paper="a4"] { font-size: 13px; padding: 14mm 18mm; width: 210mm; }
${root} .r-head { display: grid; gap: 0.4mm; justify-items: center; text-align: center; }
${root} .r-logo { display: block; margin-bottom: 1.5mm; max-height: 16mm; max-width: 70%; object-fit: contain; }
${root}[data-paper="58mm"] .r-logo, ${root}[data-paper="80mm"] .r-logo { filter: grayscale(1) contrast(1.15); }
${root} .r-store { font-size: 1.35em; font-weight: 700; line-height: 1.2; }
${root} .r-title { font-weight: 700; letter-spacing: 0.08em; margin: 2.5mm 0 1.5mm; text-align: center; text-transform: uppercase; }
${root} .r-stamp { border: 1.5px solid #000; font-weight: 700; margin: 0 0 2mm; padding: 1.2mm 1.5mm; text-align: center; }
${root} .r-rule { border-top: 1px dashed #000; margin: 2mm 0; }
${root} .r-row { align-items: baseline; display: flex; gap: 2mm; justify-content: space-between; }
${root} .r-row > span:first-child { min-width: 0; }
${root} .r-row > span:last-child { flex: none; text-align: right; white-space: nowrap; }
${root} .r-meta .r-row > span:last-child { flex: 0 1 auto; white-space: normal; }
${root} .r-items-head { font-weight: 700; }
${root} .r-item {
  break-inside: avoid;
  display: grid;
  gap: 0 2mm;
  grid-template-areas: "name name" "calc total";
  grid-template-columns: minmax(0, 1fr) auto;
  padding: 0.8mm 0;
}
${root} .r-items-head.r-item { grid-template-areas: "name total"; }
${root} .r-items-head .r-item-calc { display: none; }
${root} .r-item-name { font-weight: 600; grid-area: name; }
${root} .r-item-calc { grid-area: calc; }
${root} .r-item-calc > span { display: block; }
${root} .r-item-total { align-self: end; font-weight: 600; grid-area: total; text-align: right; white-space: nowrap; }
${root}[data-paper="a4"] .r-item,
${root}[data-paper="a4"] .r-items-head.r-item {
  border-bottom: 1px solid #ccc;
  grid-template-areas: "name calc total";
  grid-template-columns: minmax(0, 1fr) 60mm 34mm;
  padding: 1.5mm 0;
}
${root}[data-paper="a4"] .r-items-head .r-item-calc { display: block; }
${root} .r-totals, ${root} .r-pay { display: grid; gap: 0.6mm; }
${root} .r-grand { font-size: 1.3em; font-weight: 800; margin-top: 0.8mm; }
${root} .r-due { font-weight: 700; }
${root} .r-foot { display: grid; gap: 0.5mm; text-align: center; }
${root} .r-small { font-size: 0.85em; }
${root} .r-strong { font-weight: 700; }
`;
}
