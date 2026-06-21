import { ShoppingCart } from "lucide-react";
import { DataTableCard } from "../../../components/dashboard/data-table-card";

export function AbandonedCarts() {
  return (
    <DataTableCard title="Abandoned Carts">
      <table className="w-full min-w-[560px] text-left text-[11px]">
        <thead className="bg-[#f7f7fa] text-[#3f4049]">
          <tr><th className="rounded-l-md px-3 py-2.5 font-medium">Customer Name</th><th className="px-3 py-2.5 font-medium">Email</th><th className="px-3 py-2.5 font-medium">Total Product</th><th className="rounded-r-md px-3 py-2.5 font-medium">Total Amount</th></tr>
        </thead>
      </table>
      <div className="grid min-h-[190px] place-items-center text-center">
        <div>
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#f3f0ff] text-[#7c3aed]"><ShoppingCart className="h-4 w-4" /></span>
          <p className="mt-3 text-xs font-semibold text-[#363740]">No abandoned carts</p>
          <p className="mt-1 text-[11px] text-[#8a8b95]">Abandoned checkout activity will appear here when available.</p>
        </div>
      </div>
    </DataTableCard>
  );
}
