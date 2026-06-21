import Link from "next/link";
import { DataTableCard } from "../../../components/dashboard/data-table-card";
import { StatusBadge } from "../../../components/dashboard/status-badge";
import type { DashboardRecentOrder } from "../analytics.types";

type RecentOrdersProps = { currency: string; orders: DashboardRecentOrder[] };

export function RecentOrders({ currency, orders }: RecentOrdersProps) {
  return (
    <DataTableCard action={<Link className="text-[11px] font-semibold text-[#6d3cf5]" href="/dashboard/orders">View all</Link>} title="Latest Orders">
      {orders.length === 0 ? <Empty label="No orders yet" /> : (
        <table className="w-full min-w-[560px] text-left text-[11px]">
          <thead className="bg-[#f7f7fa] text-[#3f4049]"><tr><th className="rounded-l-md px-3 py-2.5 font-medium">Order ID</th><th className="px-3 py-2.5 font-medium">Customer Name</th><th className="px-3 py-2.5 font-medium">Amount</th><th className="rounded-r-md px-3 py-2.5 font-medium">Status</th></tr></thead>
          <tbody className="divide-y divide-[#f0eff5]">
            {orders.slice(0, 5).map((order) => (
              <tr key={order.id}>
                <td className="px-3 py-3"><Link className="font-medium text-[#272832]" href={`/dashboard/orders/${order.id}`}>{order.orderNumber}</Link><span className="mt-0.5 block text-[9px] text-[#92939d]">{formatDate(order.createdAt)}</span></td>
                <td className="px-3 py-3">{order.customerName}</td>
                <td className="px-3 py-3 font-medium">{formatMoney(order.totalAmount, order.currency || currency)}</td>
                <td className="px-3 py-3"><StatusBadge tone={statusTone(order.status)}>{order.status.toLowerCase()}</StatusBadge></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </DataTableCard>
  );
}

function Empty({ label }: { label: string }) { return <div className="grid min-h-32 place-items-center text-xs text-[#8b8c97]">{label}</div>; }
function formatMoney(value: string, currency: string) { return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value)); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value); }
function statusTone(status: string): "green" | "purple" | "amber" | "red" | "gray" { if (status === "COMPLETED") return "green"; if (status === "CANCELLED") return "red"; if (status === "PENDING") return "amber"; return "purple"; }
