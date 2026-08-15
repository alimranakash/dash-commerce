import { ShoppingCart } from "lucide-react";
import Link from "next/link";
import { DataTableCard } from "../../../components/dashboard/data-table-card";
import type { AbandonedCartRecord } from "../../abandoned-carts/abandoned-cart.types";

export function AbandonedCarts({ carts }: { carts: AbandonedCartRecord[] }) {
  return (
    <DataTableCard title="Abandoned Carts">
      <table className="w-full min-w-[560px] text-left text-[11px]">
        <thead className="bg-[#f7f7fa] text-[#3f4049]">
          <tr><th className="rounded-l-md px-3 py-2.5 font-medium">Customer Name</th><th className="px-3 py-2.5 font-medium">Email</th><th className="px-3 py-2.5 font-medium">Total Product</th><th className="rounded-r-md px-3 py-2.5 font-medium">Total Amount</th></tr>
        </thead>
        {carts.length ? (
          <tbody>
            {carts.map((cart) => (
              <tr className="border-t border-[#f0f0f5] text-[#4a4b57]" key={cart.id}>
                <td className="px-3 py-2.5 font-medium text-[#30313d]">{cart.customerName}</td>
                <td className="px-3 py-2.5">{cart.email ?? "-"}</td>
                <td className="px-3 py-2.5">{cart.items.reduce((total, item) => total + item.quantity, 0)}</td>
                <td className="px-3 py-2.5 font-semibold">{formatMoney(cart.cartValue, cart.currency)}</td>
              </tr>
            ))}
          </tbody>
        ) : null}
      </table>
      {carts.length ? (
        <div className="px-3 pt-3 text-right">
          <Link className="text-[11px] font-semibold text-[#6d3cf5]" href="/dashboard/abandoned-cart">View all abandoned carts</Link>
        </div>
      ) : (
        <div className="grid min-h-[190px] place-items-center text-center">
          <div>
            <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[#f3f0ff] text-[#7c3aed]"><ShoppingCart className="h-4 w-4" /></span>
            <p className="mt-3 text-xs font-semibold text-[#363740]">No abandoned carts</p>
            <p className="mt-1 text-[11px] text-[#8a8b95]">Carts left without checking out will appear here.</p>
          </div>
        </div>
      )}
    </DataTableCard>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}
