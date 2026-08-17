import { CalendarClock, CheckCircle2, Edit3, FileText, PackageCheck, ReceiptText, Trash2, Truck, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GatedActionButton } from "../../../../modules/billing/components/gated-action-button";
import { DeleteConfirmationButton } from "../../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { cancelPurchaseAction, markPurchaseReceivedAction } from "../../../../modules/purchases/purchase.actions";
import { PurchaseStatusBadge } from "../../../../modules/purchases/components/purchase-status-badge";
import { getPurchaseByIdForStore } from "../../../../modules/purchases/purchase.service";
import { requireStore } from "../../../../modules/stores/queries";

type PurchaseDetailsPageProps = {
  params: Promise<{
    purchaseId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PurchaseDetailsPage({ params, searchParams }: PurchaseDetailsPageProps) {
  const store = await requireStore();
  const { purchaseId } = await params;
  const purchase = await getPurchaseByIdForStore(store.organizationId, store.id, purchaseId);
  const message = getDetailsMessage(await searchParams);

  if (!purchase) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Purchases</p>
            <h1 className="m-0 text-2xl font-semibold text-[#20212a]">{purchase.purchaseNumber}</h1>
            <p className="mt-2 text-sm text-[#777985]">Created {formatDate(purchase.createdAt)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="secondary link-button min-h-10" href="/dashboard/purchases">
              Back to Purchases
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#ddd6fe] bg-white px-4 text-xs font-semibold text-[#6d3cf5]" href={`/dashboard/purchases/${purchase.id}/edit`}>
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </Link>
            {purchase.status !== "RECEIVED" && purchase.status !== "CANCELLED" ? (
              <GatedActionButton
                action={markPurchaseReceivedAction.bind(null, purchase.id)}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white disabled:opacity-60"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark as Received
              </GatedActionButton>
            ) : null}
            {purchase.status !== "CANCELLED" ? (
              <DeleteConfirmationButton action={cancelPurchaseAction.bind(null, purchase.id)} ariaLabel={`Cancel ${purchase.purchaseNumber}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-700" title="Cancel purchase">
                <Trash2 className="h-3.5 w-3.5" /> Cancel
              </DeleteConfirmationButton>
            ) : null}
          </div>
        </div>

        {message ? <p className="success-message">{message}</p> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ececf5] pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
                  <Truck className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="m-0 text-base font-semibold">Supplier Information</h2>
                  <p className="mt-1 text-xs text-[#85869a]">{purchase.supplier.companyName ?? "Supplier profile"}</p>
                </div>
              </div>
              <PurchaseStatusBadge status={purchase.status} />
            </header>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoTile label="Supplier" value={purchase.supplier.name} />
              <InfoTile label="Phone" value={purchase.supplier.phone} />
              <InfoTile label="Email" value={purchase.supplier.email ?? "No email"} />
              <InfoTile label="Purchase Date" value={formatDate(purchase.purchaseDate)} />
              <InfoTile wide label="Address" value={purchase.supplier.address ?? "No address"} />
              <InfoTile wide label="Notes" value={purchase.notes ?? "No notes"} />
            </dl>
          </section>

          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <h2 className="m-0 text-base font-semibold">Purchase Summary</h2>
            <div className="mt-5 grid gap-3">
              <SummaryMetric icon={ReceiptText} label="Items" value={String(purchase.items.length)} />
              <SummaryMetric icon={WalletCards} label="Total" value={formatMoney(purchase.totalAmount.toString(), store.currency)} />
              <SummaryMetric icon={CalendarClock} label="Received" value={purchase.receivedAt ? formatDate(purchase.receivedAt) : "Not received"} />
            </div>
          </section>
        </div>

        <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <h2 className="m-0 text-base font-semibold">Items</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead className="bg-[#f7f7fa] text-[#565762]">
                <tr>
                  <th className="rounded-l-lg p-3">Product</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Quantity</th>
                  <th className="p-3">Unit Cost</th>
                  <th className="rounded-r-lg p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {purchase.items.map((item) => (
                  <tr className="border-b border-[#efeff5] transition hover:bg-[#faf9ff]" key={item.id}>
                    <td className="p-3 font-semibold">{item.productName}</td>
                    <td className="p-3 text-[#686a76]">{item.sku ?? "-"}</td>
                    <td className="p-3">{item.quantity}</td>
                    <td className="p-3">{formatMoney(item.unitCost.toString(), store.currency)}</td>
                    <td className="p-3 text-right font-semibold">{formatMoney(item.totalCost.toString(), store.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-3">
          <PaymentCard label="Subtotal" value={formatMoney(purchase.subtotalAmount.toString(), store.currency)} />
          <PaymentCard label="Paid" value={formatMoney(purchase.paidAmount.toString(), store.currency)} />
          <PaymentCard highlight label="Due" value={formatMoney(purchase.dueAmount.toString(), store.currency)} />
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <PlaceholderCard icon={PackageCheck} title="Inventory" text="Selected product stock increases once when this purchase is received." />
          <PlaceholderCard icon={WalletCards} title="Supplier Payments" text="Payment ledger and supplier settlements are reserved for a future module." />
          <PlaceholderCard icon={FileText} title="Activity" text="Purchase updates and supplier activity will appear here later." />
        </div>
      </section>
    </DashboardShell>
  );
}

function InfoTile({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="text-xs font-semibold text-[#777985]">{label}</dt>
      <dd className="mb-0 mt-2 whitespace-pre-line text-sm font-medium text-[#20212a]">{value}</dd>
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value }: { icon: typeof ReceiptText; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f3f0ff] text-[#7c3aed]">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <span className="text-xs font-semibold text-[#777985]">{label}</span>
        <strong className="block text-sm text-[#20212a]">{value}</strong>
      </div>
    </div>
  );
}

function PaymentCard({ highlight, label, value }: { highlight?: boolean; label: string; value: string }) {
  return (
    <section className={`rounded-xl border p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)] ${highlight ? "border-[#ddd6fe] bg-[#f8f5ff]" : "border-[#ececf5] bg-white"}`}>
      <span className="text-xs font-semibold text-[#777985]">{label}</span>
      <strong className="mt-2 block text-xl text-[#20212a]">{value}</strong>
    </section>
  );
}

function PlaceholderCard({ icon: Icon, text, title }: { icon: typeof PackageCheck; text: string; title: string }) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f3f0ff] text-[#7c3aed]">
        <Icon className="h-5 w-5" />
      </span>
      <h2 className="mb-0 mt-4 text-base font-semibold">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#777985]">{text}</p>
    </section>
  );
}

function getDetailsMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.updated) return "Purchase updated.";
  if (searchParams.received) return "Purchase marked as received.";
  return null;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}
