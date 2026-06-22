import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, FileSearch, ReceiptText } from "lucide-react";
import Link from "next/link";
import { SummaryMetricCard } from "../../../components/dashboard/summary-metric-card";
import type { TransactionRow, TransactionSummary } from "../transaction.types";

export function TransactionDashboard({ metrics, rows, currency }: { currency: string; metrics: TransactionSummary["metrics"]; rows: TransactionRow[] }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryMetricCard icon={ReceiptText} label="Total Transactions" value={formatNumber(metrics.total)} />
        <SummaryMetricCard icon={ArrowUpRight} label="Total Payments" value={formatMoney(metrics.payments, currency)} />
        <SummaryMetricCard icon={ArrowDownLeft} label="Total Refunds" value={formatMoney(metrics.refunds, currency)} />
        <SummaryMetricCard icon={CircleDollarSign} label="Net Amount" value={formatMoney(metrics.netAmount, currency)} />
      </div>
      <section className="w-[calc(100vw-2rem)] max-w-[calc(100vw-2rem)] min-w-0 overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)] sm:w-full sm:max-w-full">
        {rows.length ? (
          <div className="max-w-full overflow-x-auto p-4">
            <table className="w-full min-w-[980px] border-collapse text-left text-xs">
              <thead className="bg-[#f7f7fa] text-[#5f616d]"><tr>{["Transaction ID", "Order Number", "Customer", "Type", "Amount", "Status", "Date", "Action"].map((header) => <th className="p-3 font-semibold" key={header}>{header}</th>)}</tr></thead>
              <tbody>{rows.map((row) => <tr className="border-b border-[#efeff5]" key={`${row.type}-${row.id}`}><td className="p-3 font-medium">{row.id}</td><td className="p-3">{row.orderNumber}</td><td className="p-3">{row.customer}</td><td className="p-3"><TypeBadge type={row.type} /></td><td className={`p-3 font-semibold ${row.type === "REFUND" ? "text-rose-600" : "text-[#292a34]"}`}>{row.type === "REFUND" ? "-" : ""}{formatMoney(row.amount, row.currency)}</td><td className="p-3"><StatusBadge status={row.status} /></td><td className="p-3">{formatDate(row.createdAt)}</td><td className="p-3"><Link className="font-semibold text-[#6d3cf5]" href={`/dashboard/orders/${row.orderId}`}>View</Link></td></tr>)}</tbody>
            </table>
          </div>
        ) : <TransactionEmptyState />}
      </section>
    </>
  );
}

function TransactionEmptyState() { return <div className="flex min-h-80 flex-col items-center justify-center px-6 py-14 text-center"><span className="mb-4 grid h-20 w-20 place-items-center rounded-xl bg-[#f4f1ff] text-[#7650e8]"><FileSearch className="h-12 w-12" /></span><h2 className="m-0 text-lg font-semibold">No Transactions Found.</h2><p className="mt-2 text-sm text-[#858691]">All types of payment activities will appear here once they occur.</p></div>; }
function TypeBadge({ type }: { type: TransactionRow["type"] }) { const styles = type === "PAYMENT" ? "bg-emerald-50 text-emerald-700" : type === "REFUND" ? "bg-rose-50 text-rose-700" : "bg-violet-50 text-violet-700"; return <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${styles}`}>{titleCase(type)}</span>; }
function StatusBadge({ status }: { status: string }) { return <span className="rounded-full bg-[#f0ecff] px-2.5 py-1 text-[10px] font-semibold text-[#6d3cf5]">{titleCase(status)}</span>; }
function titleCase(value: string) { return value.charAt(0) + value.slice(1).toLowerCase(); }
function formatMoney(value: number, currency: string) { return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value); }
function formatNumber(value: number) { return new Intl.NumberFormat("en").format(value); }
function formatDate(value: Date) { return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value); }
