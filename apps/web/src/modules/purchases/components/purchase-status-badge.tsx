import type { PurchaseStatus } from "../purchase.schema";

const statusStyles: Record<PurchaseStatus, string> = {
  CANCELLED: "bg-rose-50 text-rose-700",
  DRAFT: "bg-slate-100 text-slate-600",
  ORDERED: "bg-blue-50 text-blue-700",
  RECEIVED: "bg-emerald-50 text-emerald-700"
};

const statusLabels: Record<PurchaseStatus, string> = {
  CANCELLED: "Cancelled",
  DRAFT: "Draft",
  ORDERED: "Ordered",
  RECEIVED: "Received"
};

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusStyles[status]}`}>
      {statusLabels[status]}
    </span>
  );
}
