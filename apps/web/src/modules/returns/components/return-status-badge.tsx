import { orderReturnStatusLabels, orderReturnTypeLabels } from "../return.types";
import type { OrderReturnStatus, OrderReturnType } from "../return.schema";

/**
 * The workflow state of one request.
 *
 * Deliberately not the shared OrderStatusBadge: these statuses do not overlap
 * with an order's, and "Received" reading amber next to a green "Completed" is
 * what tells a seller at a glance which requests still need them.
 */
export function ReturnStatusBadge({ status }: { status: string }) {
  const label = orderReturnStatusLabels[status as OrderReturnStatus] ?? status;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${returnStatusStyle(status)}`}
    >
      {label}
    </span>
  );
}

/** Which of the three settlements this is, in the colours the nav uses. */
export function ReturnTypeBadge({ type }: { type: string }) {
  const label = orderReturnTypeLabels[type as OrderReturnType] ?? type;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${returnTypeStyle(type)}`}
    >
      {label}
    </span>
  );
}

export function returnStatusStyle(status: string) {
  if (status === "COMPLETED") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "APPROVED") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "IN_TRANSIT") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "RECEIVED") return "border-violet-200 bg-violet-50 text-violet-700";
  if (status === "REJECTED" || status === "CANCELLED")
    return "border-rose-200 bg-rose-50 text-rose-700";

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function returnTypeStyle(type: string) {
  if (type === "EXCHANGE") return "border-indigo-200 bg-indigo-50 text-indigo-700";
  if (type === "REFUND") return "border-rose-200 bg-rose-50 text-rose-700";

  return "border-teal-200 bg-teal-50 text-teal-700";
}
