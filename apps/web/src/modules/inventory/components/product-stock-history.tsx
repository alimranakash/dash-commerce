import Link from "next/link";
import { StockMovementBadge } from "./stock-movement-badge";
import type { StockMovementType } from "../inventory.schema";

type StockMovement = {
  createdAt: Date;
  id: string;
  newQuantity: number;
  previousQuantity: number;
  quantityChange: number;
  reason: string;
  sourceType: string;
  type: StockMovementType;
};

type ProductStockHistoryProps = {
  movements: StockMovement[];
  productId: string;
};

export function ProductStockHistory({ movements, productId }: ProductStockHistoryProps) {
  return (
    <div className="panel-card mt-5 p-4 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-base font-semibold text-[#20212c]">Stock History</h2>
          <p className="m-0 mt-1 text-xs text-[#7b7c88]">Recent inventory changes for this product.</p>
        </div>
        <Link className="secondary link-button" href={`/dashboard/inventory/products/${productId}`}>
          View all
        </Link>
      </div>
      {movements.length ? (
        <div className="overflow-hidden rounded-xl border border-[#efeff5] bg-white">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="bg-[#f7f7fa] text-[#565762]">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Type</th>
                  <th className="px-4 py-3 font-semibold">Change</th>
                  <th className="px-4 py-3 font-semibold">Previous</th>
                  <th className="px-4 py-3 font-semibold">New</th>
                  <th className="px-4 py-3 font-semibold">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#efeff5]">
                {movements.map((movement) => (
                  <tr className="transition hover:bg-[#fbfaff]" key={movement.id}>
                    <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{formatDate(movement.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-4"><StockMovementBadge type={movement.type} /></td>
                    <td className={`whitespace-nowrap px-4 py-4 font-semibold ${movement.quantityChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {movement.quantityChange >= 0 ? "+" : ""}
                      {movement.quantityChange}
                    </td>
                    <td className="px-4 py-4 text-[#30313d]">{movement.previousQuantity}</td>
                    <td className="px-4 py-4 text-[#30313d]">{movement.newQuantity}</td>
                    <td className="max-w-[260px] px-4 py-4 text-[#565762]">{movement.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-6 text-sm text-[#7b7c88]">
          No stock movements have been recorded for this product yet.
        </div>
      )}
    </div>
  );
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
