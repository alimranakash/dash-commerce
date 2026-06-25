import { CalendarClock, Edit3, PackageCheck, Trash2, UserRound, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ComponentType } from "react";
import { DeleteConfirmationButton } from "../../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { SalePaymentStatusBadge, SaleStatusBadge, saleTypeLabel } from "../../../../modules/sales/components/sale-badges";
import { paymentMethodLabel } from "../../../../modules/sales/components/sale-list";
import { voidSaleAction } from "../../../../modules/sales/sale.actions";
import { getSaleByIdForStore } from "../../../../modules/sales/sale.service";
import { requireStore } from "../../../../modules/stores/queries";

type SaleDetailsPageProps = {
  params: Promise<{ saleId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SaleDetailsPage({ params, searchParams }: SaleDetailsPageProps) {
  const store = await requireStore();
  const { saleId } = await params;
  const sale = await getSaleByIdForStore(store.organizationId, store.id, saleId);
  const message = getDetailsMessage(await searchParams);

  if (!sale) notFound();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Sales</p>
            <h1 className="m-0 text-2xl font-semibold text-[#20212a]">{sale.saleNumber}</h1>
            <p className="mt-2 text-sm text-[#777985]">{saleTypeLabel(sale.saleType)} sale on {formatDate(sale.saleDate)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="secondary link-button min-h-10" href="/dashboard/sales">Back to Sales</Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#ddd6fe] bg-white px-4 text-xs font-semibold text-[#6d3cf5]" href={`/dashboard/sales/${sale.id}/edit`}>
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </Link>
            {sale.status !== "CANCELLED" ? (
              <DeleteConfirmationButton action={voidSaleAction.bind(null, sale.id)} ariaLabel={`Void ${sale.saleNumber}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-700" title="Void sale">
                <Trash2 className="h-3.5 w-3.5" /> Void
              </DeleteConfirmationButton>
            ) : null}
          </div>
        </div>

        {message ? <p className="success-message">{message}</p> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ececf5] pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]"><UserRound className="h-6 w-6" /></span>
                <div>
                  <h2 className="m-0 text-base font-semibold">Customer Information</h2>
                  <p className="mt-1 text-xs text-[#85869a]">{sale.customer ? "Linked customer profile" : "Guest checkout"}</p>
                </div>
              </div>
              <SaleStatusBadge status={sale.status} />
            </header>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoTile label="Customer" value={sale.customer?.name ?? "Walk-in customer"} />
              <InfoTile label="Phone" value={sale.customer?.phone ?? "No phone"} />
              <InfoTile label="Email" value={sale.customer?.email ?? "No email"} />
              <InfoTile label="Sale Type" value={saleTypeLabel(sale.saleType)} />
            </dl>
          </section>

          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <h2 className="m-0 text-base font-semibold">Payment Summary</h2>
            <div className="mt-5 grid gap-3">
              <SummaryMetric icon={WalletCards} label="Payment Method" value={paymentMethodLabel(sale.paymentMethod)} />
              <div className="rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4">
                <span className="text-xs font-semibold text-[#777985]">Payment Status</span>
                <div className="mt-2"><SalePaymentStatusBadge status={sale.paymentStatus} /></div>
              </div>
              <SummaryMetric icon={CalendarClock} label="Sale Date" value={formatDate(sale.saleDate)} />
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <h2 className="m-0 text-base font-semibold">Products</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="bg-[#f7f7fa] text-[#565762]">
                <tr>
                  <th className="rounded-l-lg p-3">Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Qty</th>
                  <th className="p-3">Unit Price</th>
                  <th className="p-3">Discount</th>
                  <th className="rounded-r-lg p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr className="border-b border-[#efeff5] transition hover:bg-[#faf9ff]" key={item.id}>
                    <td className="p-3 font-semibold">{item.productName}</td>
                    <td className="p-3 text-[#686a76]">{item.sku ?? "-"}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">{formatMoney(item.unitPrice.toString(), store.currency)}</td>
                    <td className="p-3">{formatMoney(item.discount.toString(), store.currency)}</td>
                    <td className="p-3 text-right font-semibold">{formatMoney(item.total.toString(), store.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-4">
          <PaymentCard label="Subtotal" value={formatMoney(sale.subtotal.toString(), store.currency)} />
          <PaymentCard label="Total" value={formatMoney(sale.total.toString(), store.currency)} />
          <PaymentCard label="Paid" value={formatMoney(sale.paidAmount.toString(), store.currency)} />
          <PaymentCard highlight label="Due" value={formatMoney(sale.dueAmount.toString(), store.currency)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <h2 className="m-0 text-base font-semibold">Notes</h2>
            <p className="mb-0 mt-3 whitespace-pre-line text-sm leading-6 text-[#777985]">{sale.notes ?? "No notes added."}</p>
          </section>
          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f3f0ff] text-[#7c3aed]"><PackageCheck className="h-5 w-5" /></span>
            <h2 className="mb-0 mt-4 text-base font-semibold">Inventory</h2>
            <p className="mt-2 text-sm leading-6 text-[#777985]">Stock is deducted once when the sale first becomes completed. Returns will restore stock in the future returns module.</p>
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4"><dt className="text-xs font-semibold text-[#777985]">{label}</dt><dd className="mb-0 mt-2 text-sm font-medium text-[#20212a]">{value}</dd></div>;
}

function SummaryMetric({ icon: Icon, label, value }: { icon: ComponentType<{ className?: string }>; label: string; value: string }) {
  return <div className="flex items-center gap-3 rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f3f0ff] text-[#7c3aed]"><Icon className="h-4 w-4" /></span><div><span className="text-xs font-semibold text-[#777985]">{label}</span><strong className="block text-sm text-[#20212a]">{value}</strong></div></div>;
}

function PaymentCard({ highlight, label, value }: { highlight?: boolean; label: string; value: string }) {
  return <section className={`rounded-xl border p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)] ${highlight ? "border-[#ddd6fe] bg-[#f8f5ff]" : "border-[#ececf5] bg-white"}`}><span className="text-xs font-semibold text-[#777985]">{label}</span><strong className="mt-2 block text-xl text-[#20212a]">{value}</strong></section>;
}

function getDetailsMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.updated) return "Sale updated.";
  return null;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}
