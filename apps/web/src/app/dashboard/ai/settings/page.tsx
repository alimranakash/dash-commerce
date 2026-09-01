import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { StatusBadge } from "../../../../components/dashboard/status-badge";
import { AiProviderSettings } from "../../../../modules/ai-provider/components/ai-provider-settings";
import { saveAiProviderSettingsAction } from "../../../../modules/ai-provider/ai-provider.actions";
import { getAiSettingsView } from "../../../../modules/ai-provider/ai-provider.service";
import {
  AiCapabilityList,
  capabilityCounts
} from "../../../../modules/storeos/components/ai-capability-list";
import { StoreOSConnectionPanel } from "../../../../modules/storeos/components/storeos-connection-panel";
import { reconnectStoreOSAction } from "../../../../modules/storeos/storeos.actions";
import { getStoreOSConnectionView } from "../../../../modules/storeos/storeos.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

/**
 * Dashboard → StoreIM AI → Settings.
 *
 * Three sections, one card each. They were each wrapped in a `.dashboard-shell`
 * that drew a card of its own around a component that already drew one, so every
 * panel rendered as a box inside a box; the sections now own their card and the
 * page is only the order they come in.
 *
 * That order is the order a seller needs them: the engine that answers, the
 * platform link behind it, then what the link covers.
 *
 * The Shopping Agent's switch is *not* here, though it reads from the same row.
 * It is the one AI surface a seller's customers meet, so it earned a page of its
 * own in the menu — and a seller looking for it by name should find it there
 * rather than scrolled halfway down a settings page.
 *
 * `getStoreAccess()` rather than `requireStore()`, matching Integrations: a
 * member may read the status when something has stopped working, but the buttons
 * are a manager's. Both actions re-check for themselves regardless.
 */
export default async function AiSettingsPage() {
  const access = await getStoreAccess();
  // Views rather than rows, for both credentials: the operator's link state and
  // the store's own provider keys are collapsed on the server, so neither the
  // platform credential nor a seller's API key reaches this render.
  const [connection, aiSettings] = await Promise.all([
    getStoreOSConnectionView(access.store.id),
    getAiSettingsView(access.store.id)
  ]);
  const counts = capabilityCounts(connection.capabilities);

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">StoreIM AI</p>
            <h1>Settings</h1>
            <p className="auth-copy">
              The engine that answers for this store, the platform link behind it, and which AI
              surfaces that link covers.
            </p>
          </div>
        </div>

        <div className="aiset-page">
          <AiProviderSettings
            action={saveAiProviderSettingsAction}
            canManage={access.canManage}
            settings={aiSettings}
          />

          <StoreOSConnectionPanel
            action={reconnectStoreOSAction}
            canManage={access.canManage}
            connection={connection}
          />

          <section className="aiset-section">
            <div className="aiset-head">
              <div className="aiset-head-text">
                <p className="aiset-eyebrow">Capabilities</p>
                <h2>What StoreIM AI can do here</h2>
                <p className="aiset-section-copy">
                  Every surface below runs on the one connection above. The rest are negotiated at
                  connect time, so this store will not have to reconnect when they ship.
                </p>
              </div>
              <StatusBadge tone={counts.active > 0 ? "green" : "gray"}>
                {`${counts.active} of ${counts.available} live`}
              </StatusBadge>
            </div>

            <AiCapabilityList granted={connection.capabilities} />
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
