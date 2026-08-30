import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { AiCapabilityList } from "../../../../modules/storeos/components/ai-capability-list";
import { StoreOSConnectionPanel } from "../../../../modules/storeos/components/storeos-connection-panel";
import { reconnectStoreOSAction } from "../../../../modules/storeos/storeos.actions";
import { getStoreOSConnectionView } from "../../../../modules/storeos/storeos.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

/**
 * Dashboard → Dash AI → Settings.
 *
 * The connection itself, split off the chat page. Asking the assistant a
 * question and re-establishing the link it answers over are different acts by
 * different people — `sendStoreOSChatMessageAction` guards with `requireStore()`
 * and `reconnectStoreOSAction` with `requireStoreManager()` — so they are now
 * different pages rather than two halves of one screen.
 *
 * `getStoreAccess()` rather than `requireStore()`, matching Integrations: a
 * member may read the status when something has stopped working, but the button
 * is a manager's. The action re-checks for itself regardless.
 */
export default async function AiSettingsPage() {
  const access = await getStoreAccess();
  // A view rather than the row: the operator's link state is collapsed on the
  // server, so nothing about the platform credential reaches this render.
  const connection = await getStoreOSConnectionView(access.store.id);

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Dash AI</p>
            <h1>Settings</h1>
            <p className="auth-copy">
              How this store connects to Dash AI, and which AI surfaces that connection covers.
            </p>
          </div>
        </div>

        <div className="dashboard-shell">
          <StoreOSConnectionPanel
            action={reconnectStoreOSAction}
            canManage={access.canManage}
            connection={connection}
          />
        </div>

        <div className="dashboard-shell">
          <section className="storeos-panel">
            <div>
              <p className="eyebrow">Capabilities</p>
              <h2>What Dash AI can do here</h2>
              <p>
                Every surface below runs on the one connection above. Chat answers questions today;
                the rest are negotiated at connect time so this store will not have to reconnect
                when they ship.
              </p>
            </div>
            <AiCapabilityList granted={connection.capabilities} />
          </section>
        </div>
      </section>
    </DashboardShell>
  );
}
