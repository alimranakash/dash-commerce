import { CircleDollarSign, FileSearch, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { SummaryMetricCard } from "../../../components/dashboard/summary-metric-card";
import type { CustomerRow, CustomerSummary } from "../customer.types";

export function CustomerDashboard({ currency, metrics, rows }: { currency: string; metrics: CustomerSummary["metrics"]; rows: CustomerRow[] }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard icon={Users} label="Total Customers" value={formatNumber(metrics.total)} />
        <SummaryMetricCard icon={UserPlus} label="New Customers" value={formatNumber(metrics.newCustomers)} />
        <SummaryMetricCard icon={Users} label="Returning Customers" value={formatNumber(metrics.returning)} />
        <SummaryMetricCard icon={CircleDollarSign} label="Average Customer Value" value={formatMoney(metrics.averageValue, currency)} />
      </div>
      <section className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] min-w-0 overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)] sm:w-full sm:max-w-full">
        {rows.length ? (
          <div className="max-w-full overflow-x-auto p-4"><table className="w-full min-w-[900px] border-collapse text-left text-xs"><thead className="bg-[#f7f7fa] text-[#5f616d]"><tr>{["Customer Name", "Email", "Phone", "Orders", "Total Spent", "Last Order", "Action"].map((header) => <th className="p-3 font-semibold" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((customer) => <tr className="border-b border-[#efeff5]" key={customer.id}><td className="p-3 font-medium">{customer.name}</td><td className="p-3">{customer.email ?? "—"}</td><td className="p-3">{customer.phone}</td><td className="p-3"><span className="rounded-full bg-[#f0ecff] px-2.5 py-1 text-[10px] font-semibold text-[#6d3cf5]">{formatNumber(customer.orderCount)}</span></td><td className="p-3 font-semibold">{formatMoney(customer.totalSpent, customer.currency)}</td><td className="p-3">{customer.lastOrderAt ? formatDate(customer.lastOrderAt) : "No orders"}</td><td className="p-3"><Link className="font-semibold text-[#6d3cf5]" href={`/dashboard/orders?search=${encodeURIComponent(customer.phone)}`}>View orders</Link></td></tr>)}</tbody></table></div>
        ) : <CustomerEmptyState />}
      </section>
    </>
  );
}

function CustomerEmptyState() { return <div className="flex min-h-80 flex-col items-center justify-center px-6 py-14 text-center"><span className="mb-4 grid h-20 w-20 place-items-center rounded-xl bg-[#f4f1ff] text-[#7650e8]"><FileSearch className="h-12 w-12" /></span><h2 className="m-0 text-lg font-semibold">No Customers Found</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#858691]">You&apos;re yet to receive any customers in your store. Keep promoting your store to bring in your first customer.</p></div>; }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value); }
function formatNumber(value: number) { return new Intl.NumberFormat("en").format(value); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value); }
