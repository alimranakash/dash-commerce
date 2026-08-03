import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { MarketingSettingsForm } from "../../../../modules/settings/components/marketing-settings-form";
import { updateMarketingSettingsFormAction } from "../../../../modules/settings/settings.actions";
import { getModuleSettings } from "../../../../modules/settings/settings.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function MarketingSettingsPage() {
  const store = await requireStore();
  const moduleSettings = await getModuleSettings(store.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Marketing Information</h1>
          <p className="mt-2 text-sm text-[#737582]">Add tracking pixels, analytics scripts, and domain verification codes for your store.</p>
        </div>
        <MarketingSettingsForm action={updateMarketingSettingsFormAction} settings={moduleSettings.marketing} />
      </section>
    </DashboardShell>
  );
}
