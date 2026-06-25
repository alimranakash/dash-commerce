import type { SalePaymentStatus, SaleStatus, SaleType } from "../sale.schema";

const saleStatusStyles: Record<SaleStatus, string> = {
  CANCELLED: "bg-rose-50 text-rose-700",
  COMPLETED: "bg-emerald-50 text-emerald-700",
  DRAFT: "bg-slate-100 text-slate-600",
  RETURNED: "bg-amber-50 text-amber-700"
};

const paymentStatusStyles: Record<SalePaymentStatus, string> = {
  PAID: "bg-emerald-50 text-emerald-700",
  PARTIAL: "bg-blue-50 text-blue-700",
  UNPAID: "bg-amber-50 text-amber-700"
};

export function SaleStatusBadge({ status }: { status: SaleStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${saleStatusStyles[status]}`}>
      {title(status)}
    </span>
  );
}

export function SalePaymentStatusBadge({ status }: { status: SalePaymentStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${paymentStatusStyles[status]}`}>
      {title(status)}
    </span>
  );
}

export function saleTypeLabel(value: SaleType) {
  return title(value);
}

export function title(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}
