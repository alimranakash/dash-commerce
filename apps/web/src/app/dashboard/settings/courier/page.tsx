import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CourierSettingsForm } from "../../../../modules/settings/components/courier-settings-form";
import { updateCourierSettingsFormAction } from "../../../../modules/settings/settings.actions";
import { getModuleSettings } from "../../../../modules/settings/settings.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CourierSettingsPage() {
  const store = await requireStore();
  const moduleSettings = await getModuleSettings(store.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Courier API Setup</h1>
          <p className="mt-2 text-sm text-[#737582]">Configure courier API credentials for automatic delivery booking and tracking.</p>
        </div>
        <CourierSettingsForm action={updateCourierSettingsFormAction} settings={moduleSettings.courier} />
      </section>
    </DashboardShell>
  );
}
