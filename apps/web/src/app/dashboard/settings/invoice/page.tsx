import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { InvoiceSettingsForm } from "../../../../modules/settings/components/invoice-settings-form";
import { requireStore } from "../../../../modules/stores/queries";

export default async function InvoiceSettingsPage() {
  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div><h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Invoice Settings</h1><p className="mt-2 text-sm text-[#737582]">Configure invoice information, branding, numbering, and tax details for your store.</p></div>
        <InvoiceSettingsForm storeName={store.name} storeUrl={`https://${store.slug}.dash.com`} />
      </section>
    </DashboardShell>
  );
}
