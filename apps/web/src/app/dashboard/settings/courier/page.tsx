import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { CourierSettingsForm } from "../../../../modules/settings/components/courier-settings-form";
import { requireStore } from "../../../../modules/stores/queries";

export default async function CourierSettingsPage() {
  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Courier API Setup</h1>
          <p className="mt-2 text-sm text-[#737582]">Configure courier API credentials for automatic delivery booking and tracking.</p>
        </div>
        <CourierSettingsForm />
      </section>
    </DashboardShell>
  );
}
