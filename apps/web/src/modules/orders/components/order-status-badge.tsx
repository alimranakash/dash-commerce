type OrderStatusBadgeProps = {
  status: string;
};

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const normalized = status.toUpperCase();
  const style = statusStyle(normalized);

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${style}`}>{formatStatus(normalized)}</span>;
}

function statusStyle(status: string) {
  if (["COMPLETED", "PAID", "FULFILLED", "DELIVERED"].includes(status)) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (["PROCESSING", "CONFIRMED", "PARTIALLY_FULFILLED", "SHIPPED"].includes(status)) return "border-blue-200 bg-blue-50 text-blue-700";
  if (["CANCELLED", "FAILED", "RETURNED"].includes(status)) return "border-rose-200 bg-rose-50 text-rose-700";
  if (status === "REFUNDED") return "border-violet-200 bg-violet-50 text-violet-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
}

export function formatStatus(status: string) {
  return status.toLowerCase().split("_").map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}
