import { Building2, CalendarClock, Edit3, Mail, MapPin, NotebookText, Phone, ReceiptText, Trash2, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteConfirmationButton } from "../../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { SupplierStatusBadge } from "../../../../modules/suppliers/components/supplier-status-badge";
import { deleteSupplierFormAction } from "../../../../modules/suppliers/supplier.actions";
import { getSupplierByIdForOrganization } from "../../../../modules/suppliers/supplier.service";
import { requireStore } from "../../../../modules/stores/queries";

type SupplierDetailsPageProps = {
  params: Promise<{
    supplierId: string;
  }>;
};

export default async function SupplierDetailsPage({ params }: SupplierDetailsPageProps) {
  const store = await requireStore();
  const { supplierId } = await params;
  const supplier = await getSupplierByIdForOrganization(store.organizationId, supplierId);

  if (!supplier) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Suppliers</p>
            <h1 className="m-0 text-2xl font-semibold text-[#20212a]">{supplier.name}</h1>
            <p className="mt-2 text-sm text-[#777985]">{supplier.companyName ?? "Supplier profile"}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="secondary link-button min-h-10" href="/dashboard/suppliers">
              Back to Suppliers
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#ddd6fe] bg-white px-4 text-xs font-semibold text-[#6d3cf5]" href={`/dashboard/suppliers/${supplier.id}/edit`}>
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </Link>
            <DeleteConfirmationButton action={deleteSupplierFormAction.bind(null, supplier.id)} ariaLabel={`Delete ${supplier.name}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-700" title="Delete supplier">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DeleteConfirmationButton>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#ececf5] pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
                  <Building2 className="h-6 w-6" />
                </span>
                <div>
                  <h2 className="m-0 text-base font-semibold">Supplier Information</h2>
                  <p className="mt-1 text-xs text-[#85869a]">Core profile and contact details</p>
                </div>
              </div>
              <SupplierStatusBadge status={supplier.status} />
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoRow icon={Building2} label="Company" value={supplier.companyName ?? "—"} />
              <InfoRow icon={Phone} label="Phone" value={supplier.phone} />
              <InfoRow icon={Mail} label="Email" value={supplier.email ?? "—"} />
              <InfoRow icon={CalendarClock} label="Created" value={formatDate(supplier.createdAt)} />
              <InfoRow wide icon={MapPin} label="Address" value={supplier.address ?? "—"} />
              <InfoRow wide icon={NotebookText} label="Notes" value={supplier.notes ?? "No notes yet."} />
            </dl>
          </section>

          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <h2 className="m-0 text-base font-semibold">Summary</h2>
            <div className="mt-5 grid gap-3">
              <SummaryTile label="Purchases" value="Coming soon" />
              <SummaryTile label="Due Amount" value="৳0.00" />
              <SummaryTile label="Recent Activity" value="No activity yet" />
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <PlaceholderCard icon={ReceiptText} title="Purchases" text="Purchase history will appear here when supplier purchasing is implemented." />
          <PlaceholderCard icon={WalletCards} title="Due Amount" text="Supplier payable tracking is prepared for future ledger and payment workflows." />
          <PlaceholderCard icon={CalendarClock} title="Recent Activity" text="Supplier notes, purchases, and payment events will be shown here later." />
        </div>
      </section>
    </DashboardShell>
  );
}

function InfoRow({ icon: Icon, label, value, wide }: { icon: typeof Building2; label: string; value: string; wide?: boolean }) {
  return (
    <div className={`rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <dt className="flex items-center gap-2 text-xs font-semibold text-[#777985]">
        <Icon className="h-3.5 w-3.5 text-[#7c3aed]" /> {label}
      </dt>
      <dd className="mb-0 mt-2 whitespace-pre-line text-sm font-medium text-[#20212a]">{value}</dd>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4">
      <span className="text-xs font-semibold text-[#777985]">{label}</span>
      <strong className="mt-2 block text-lg text-[#20212a]">{value}</strong>
    </div>
  );
}

function PlaceholderCard({ icon: Icon, text, title }: { icon: typeof Building2; text: string; title: string }) {
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

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
