import type { SupplierStatus } from "../supplier.schema";

type SupplierStatusBadgeProps = {
  status: SupplierStatus;
};

export function SupplierStatusBadge({ status }: SupplierStatusBadgeProps) {
  const active = status === "ACTIVE";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}
