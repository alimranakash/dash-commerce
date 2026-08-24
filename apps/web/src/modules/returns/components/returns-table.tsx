import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ReturnStatusBadge, ReturnTypeBadge } from "./return-status-badge";

export type ReturnRow = {
  createdAt: string;
  customerName: string;
  customerPhone: string;
  dueAmount: string | null;
  id: string;
  itemSummary: string;
  orderId: string;
  orderNumber: string;
  reason: string;
  refundAmount: string;
  returnNumber: string;
  status: string;
  type: string;
};

/**
 * One table for all three surfaces.
 *
 * A return, an exchange and a refund carry the same columns — the type badge is
 * the only thing that differs — so the Return, Exchange and Refund pages are the
 * same table over a different slice rather than three near-identical components
 * drifting apart.
 */
export function ReturnsTable({ rows, showType }: { rows: ReturnRow[]; showType: boolean }) {
  return (
    <section className="min-w-0 overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <div className="max-w-full overflow-x-auto p-4">
        <table className="w-full min-w-[900px] border-collapse text-left text-xs">
          <thead className="bg-[#f7f7fa] text-[#5f616d]">
            <tr>
              <th className="p-3">Request</th>
              <th className="p-3">Order</th>
              <th className="p-3">Customer</th>
              <th className="p-3">Items</th>
              <th className="p-3">Reason</th>
              <th className="p-3 text-right">Refund</th>
              <th className="p-3">Status</th>
              <th className="p-3">Opened</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-[#efeff5] transition hover:bg-[#faf9ff]" key={row.id}>
                <td className="p-3">
                  <Link
                    className="font-semibold text-[#6d3cf5] hover:underline"
                    href={`/dashboard/orders/returns/${row.id}`}
                  >
                    {row.returnNumber}
                  </Link>
                  {showType ? (
                    <span className="mt-1.5 block">
                      <ReturnTypeBadge type={row.type} />
                    </span>
                  ) : null}
                </td>
                <td className="p-3">
                  <Link
                    className="text-[#30313d] hover:text-[#6d3cf5] hover:underline"
                    href={`/dashboard/orders/${row.orderId}`}
                  >
                    {row.orderNumber}
                  </Link>
                </td>
                <td className="p-3">
                  <strong className="block font-semibold text-[#292a34]">{row.customerName}</strong>
                  <span className="text-[#777985]">{row.customerPhone}</span>
                </td>
                <td className="p-3 text-[#686a76]">{row.itemSummary}</td>
                <td className="p-3 text-[#686a76]">{row.reason}</td>
                <td className="p-3 text-right">
                  <strong className="font-semibold text-[#292a34]">{row.refundAmount}</strong>
                  {row.dueAmount ? (
                    <span className="mt-1 block text-[10px] text-[#e49a00]">
                      {row.dueAmount} to collect
                    </span>
                  ) : null}
                </td>
                <td className="p-3">
                  <ReturnStatusBadge status={row.status} />
                </td>
                <td className="p-3 text-[#777985]">{row.createdAt}</td>
                <td className="p-3 text-right">
                  <Link
                    aria-label={`Open ${row.returnNumber}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#e5e3f1] text-[#6d3cf5] transition hover:bg-[#f7f3ff]"
                    href={`/dashboard/orders/returns/${row.id}`}
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
