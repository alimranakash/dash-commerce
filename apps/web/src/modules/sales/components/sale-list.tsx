import { Edit3, Eye, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { voidSaleAction } from "../sale.actions";
import type { SalePaymentMethod, SalePaymentStatus, SaleStatus, SaleType } from "../sale.schema";
import { SalePaymentStatusBadge, SaleStatusBadge, saleTypeLabel, title } from "./sale-badges";

type SaleListItem = {
  customer: { name: string; phone: string } | null;
  dueAmount: { toString(): string };
  id: string;
  paidAmount: { toString(): string };
  paymentMethod: SalePaymentMethod;
  paymentStatus: SalePaymentStatus;
  saleDate: Date;
  saleNumber: string;
  saleType: SaleType;
  status: SaleStatus;
  total: { toString(): string };
};

type SaleListProps = {
  currency: string;
  dateFrom?: string;
  dateTo?: string;
  filters: {
    saleType?: string;
    status?: string;
  };
  message?: string | null;
  metrics: {
    pendingPayments: string;
    thisMonth: string;
    today: string;
    total: string;
  };
  sales: SaleListItem[];
  search?: string;
  storeSlug: string;
};

export function SaleList({ currency, dateFrom, dateTo, filters, message, metrics, sales, search, storeSlug }: SaleListProps) {
  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="mx-auto grid max-w-[1480px] gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold text-[#20212a]">Sales</h1>
            <p className="mt-2 text-sm text-[#777985]">Manage online and offline sales from one place.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#ddd6fe] bg-white px-4 text-xs font-semibold text-[#6d3cf5]" href="/dashboard/sales/returns">
              <RotateCcw className="h-3.5 w-3.5" /> Sales Returns
            </Link>
            <Link className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6d28d9]" href="/dashboard/sales/new">
              <Plus className="h-3.5 w-3.5" /> New Sale
            </Link>
          </div>
        </div>

        {message ? <p className="success-message">{message}</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Sales" value={formatMoney(metrics.total, currency)} />
          <MetricCard label="Today's Sales" value={formatMoney(metrics.today, currency)} />
          <MetricCard label="This Month" value={formatMoney(metrics.thisMonth, currency)} />
          <MetricCard label="Pending Payments" value={formatMoney(metrics.pendingPayments, currency)} />
        </div>

        <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <DashboardQueryForm actionPath="/dashboard/sales" className="mb-5 grid gap-3 lg:grid-cols-[minmax(180px,1fr)_150px_150px_150px_150px_auto]">
            <input className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10" defaultValue={search} name="search" placeholder="Search sales or customers" type="search" />
            <input className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none" defaultValue={dateFrom} name="dateFrom" title="Date from" type="date" />
            <input className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none" defaultValue={dateTo} name="dateTo" title="Date to" type="date" />
            <select className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none" defaultValue={filters.status ?? ""} name="status">
              <option value="">All status</option>
              <option value="draft">Draft</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="returned">Returned</option>
            </select>
            <select className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none" defaultValue={filters.saleType ?? ""} name="saleType">
              <option value="">All types</option>
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white" type="submit"><Search className="h-3.5 w-3.5" /> Search</button>
          </DashboardQueryForm>

          {sales.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                <thead className="bg-[#f7f7f9] text-[#34353e]">
                  <tr>
                    <th className="rounded-l-md px-4 py-3 font-medium">Sale No</th>
                    <th className="px-3 py-3 font-medium">Customer</th>
                    <th className="px-3 py-3 font-medium">Type</th>
                    <th className="px-3 py-3 font-medium">Total</th>
                    <th className="px-3 py-3 font-medium">Paid</th>
                    <th className="px-3 py-3 font-medium">Due</th>
                    <th className="px-3 py-3 font-medium">Payment</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="rounded-r-md px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.map((sale) => (
                    <tr className="border-b border-[#efeff4] transition hover:bg-[#fcfbff]" key={sale.id}>
                      <td className="px-4 py-5 font-semibold text-[#34353e]">{sale.saleNumber}</td>
                      <td className="px-3 py-5">{sale.customer ? <><strong className="block text-[#34353e]">{sale.customer.name}</strong><span className="mt-1 block text-[#85869a]">{sale.customer.phone}</span></> : "Walk-in customer"}</td>
                      <td className="px-3 py-5">{saleTypeLabel(sale.saleType)}</td>
                      <td className="px-3 py-5 font-semibold">{formatMoney(sale.total.toString(), currency)}</td>
                      <td className="px-3 py-5">{formatMoney(sale.paidAmount.toString(), currency)}</td>
                      <td className="px-3 py-5">{formatMoney(sale.dueAmount.toString(), currency)}</td>
                      <td className="px-3 py-5"><div className="grid gap-1"><span>{paymentMethodLabel(sale.paymentMethod)}</span><SalePaymentStatusBadge status={sale.paymentStatus} /></div></td>
                      <td className="px-3 py-5"><SaleStatusBadge status={sale.status} /></td>
                      <td className="px-3 py-5 text-[#555660]">{formatDate(sale.saleDate)}</td>
                      <td className="px-4 py-5">
                        <div className="catalog-row-actions">
                          <Link aria-label={`View ${sale.saleNumber}`} href={`/dashboard/sales/${sale.id}`} title="View sale"><Eye aria-hidden="true" /></Link>
                          <Link aria-label={`Edit ${sale.saleNumber}`} href={`/dashboard/sales/${sale.id}/edit`} title="Edit sale"><Edit3 aria-hidden="true" /></Link>
                          <DeleteConfirmationButton action={voidSaleAction.bind(null, sale.id)} ariaLabel={`Void ${sale.saleNumber}`} title="Void sale"><Trash2 aria-hidden="true" /></DeleteConfirmationButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid min-h-[360px] place-items-center text-center">
              <div>
                <h2 className="text-lg font-semibold text-[#20212a]">No sales found</h2>
                <p className="mt-2 text-sm text-[#777985]">Create an offline sale or wait for online orders to appear here later.</p>
                <Link className="mt-4 inline-flex h-10 items-center rounded-lg border border-[#7c3aed] px-4 text-xs font-semibold text-[#6d3cf5]" href="/dashboard/sales/new">New Sale</Link>
              </div>
            </div>
          )}
        </section>
      </section>
    </DashboardShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]"><span className="text-xs font-semibold text-[#777985]">{label}</span><strong className="mt-2 block text-xl text-[#20212a]">{value}</strong></section>;
}

export function paymentMethodLabel(value: SalePaymentMethod) {
  return title(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}
