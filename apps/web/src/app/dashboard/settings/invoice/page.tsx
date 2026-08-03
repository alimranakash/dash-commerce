import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { InvoiceSettingsForm } from "../../../../modules/settings/components/invoice-settings-form";
import { updateInvoiceSettingsFormAction } from "../../../../modules/settings/settings.actions";
import { getModuleSettings } from "../../../../modules/settings/settings.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function InvoiceSettingsPage() {
  const store = await requireStore();
  const moduleSettings = await getModuleSettings(store.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div><h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Invoice Settings</h1><p className="mt-2 text-sm text-[#737582]">Configure invoice information, branding, numbering, and tax details for your store.</p></div>
        <InvoiceSettingsForm action={updateInvoiceSettingsFormAction} settings={moduleSettings.invoice} storeName={store.name} storeUrl={`https://${store.slug}.dash.com`} />
      </section>
    </DashboardShell>
  );
}
