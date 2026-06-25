import type { ExpenseStatus } from "../expense.schema";

const styles: Record<ExpenseStatus, string> = {
  CANCELLED: "bg-rose-50 text-rose-700",
  PAID: "bg-emerald-50 text-emerald-700",
  PENDING: "bg-amber-50 text-amber-700"
};

const labels: Record<ExpenseStatus, string> = {
  CANCELLED: "Cancelled",
  PAID: "Paid",
  PENDING: "Pending"
};

export function ExpenseStatusBadge({ status }: { status: ExpenseStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
