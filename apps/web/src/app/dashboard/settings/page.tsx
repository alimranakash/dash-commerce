import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { requireStore } from "../../../modules/stores/queries";

export default async function SettingsPage() {
  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Settings</p>
            <h1>Store settings</h1>
            <p className="auth-copy">Settings UI will be added after the catalog foundation.</p>
          </div>
        </div>
      </section>
    </DashboardShell>
  );
}
