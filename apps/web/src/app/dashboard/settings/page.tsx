import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { getMediaPickerAssets } from "../../../modules/media/media.service";
import { StoreSettingsForm } from "../../../modules/settings/components/store-settings-form";
import { updateStoreSettingsFormAction } from "../../../modules/settings/settings.actions";
import { getStoreSettings } from "../../../modules/settings/settings.service";
import { StoreOSConnectionPanel } from "../../../modules/storeos/components/storeos-connection-panel";
import { reconnectStoreOSAction } from "../../../modules/storeos/storeos.actions";
import { getStoreOSConnection } from "../../../modules/storeos/storeos.service";
import { requireStore } from "../../../modules/stores/queries";
import { isStoreOSConfigured } from "@dash/storeos-sdk";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({ searchParams }: SettingsPageProps) {
  const store = await requireStore();
  const [settings, storeosConnection, mediaAssets] = await Promise.all([
    getStoreSettings(store.id),
    getStoreOSConnection(store.id),
    getMediaPickerAssets(store.id)
  ]);
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
          <StoreOSConnectionPanel
            action={reconnectStoreOSAction}
            connection={
              storeosConnection
                ? {
                    lastSyncedAt: storeosConnection.lastSyncedAt?.toISOString() ?? null,
                    status: storeosConnection.status,
                    storeosConnectionId: storeosConnection.storeosConnectionId
                  }
                : null
            }
            isConfigured={isStoreOSConfigured()}
          />
        </div>
        <div className="dashboard-shell">
          <StoreSettingsForm
            action={updateStoreSettingsFormAction}
            mediaAssets={mediaAssets}
            settings={settings}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
