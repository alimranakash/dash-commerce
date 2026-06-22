import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { StoreSettingsForm } from "../../../modules/settings/components/store-settings-form";
import { updateGeneralSettingsFormAction } from "../../../modules/settings/settings.actions";
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
            <h1>General settings</h1>
            <p className="auth-copy">Manage store information and basic store configuration.</p>
          </div>
        </div>
        {message ? <p className="success-message">{message}</p> : null}
        <div className="dashboard-shell">
          <StoreSettingsForm
            action={updateGeneralSettingsFormAction}
            settings={settings}
            store={{ currency: store.currency, name: store.name, slug: store.slug, timezone: store.timezone }}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
