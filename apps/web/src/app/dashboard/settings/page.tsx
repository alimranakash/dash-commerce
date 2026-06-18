import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { StoreSettingsForm } from "../../../modules/settings/components/store-settings-form";
import { updateStoreSettingsFormAction } from "../../../modules/settings/settings.actions";
import { getStoreSettings } from "../../../modules/settings/settings.service";
import { requireStore } from "../../../modules/stores/queries";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const store = await requireStore();
  const settings = await getStoreSettings(store.id);
  const message = (await searchParams).updated ? "Store settings updated." : null;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Store settings</h1>
            <p className="auth-copy">Manage brand assets, public contact details, and social links.</p>
          </div>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="dashboard-shell">
          <StoreSettingsForm action={updateStoreSettingsFormAction} settings={settings} />
        </div>
      </section>
    </DashboardShell>
  );
}
