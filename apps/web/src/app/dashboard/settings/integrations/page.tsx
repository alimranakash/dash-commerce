import { isStoreOSConfigured } from "@dash/storeos-sdk";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { createAiApiKeyAction, revokeAiApiKeyAction } from "../../../../modules/ai/ai-key.actions";
import { listStoreApiKeys } from "../../../../modules/ai/ai-key.service";
import { AI_SCOPES, isGrantableScope } from "../../../../modules/ai/ai.schema";
import { AiIntegrationSettings } from "../../../../modules/ai/components/ai-integration-settings";
import { getStoreOSConnection } from "../../../../modules/storeos/storeos.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

/**
 * Dashboard → Settings → Integrations.
 *
 * Where a seller hands StoreOS AI a key to read this store with, and takes it
 * back. The StoreOS connection itself is shown here read-only for context —
 * reconnecting still lives on the StoreIM AI page, so there is one place that
 * owns that action.
 *
 * `getStoreAccess()` rather than `requireStore()`: a member may look at which
 * keys exist and when they were last used, which is useful when something has
 * stopped working, but only a manager may mint or revoke one. The actions
 * re-check that for themselves.
 */
export default async function IntegrationsSettingsPage() {
  const access = await getStoreAccess();
  const [keys, connection] = await Promise.all([
    listStoreApiKeys(access.store.id),
    getStoreOSConnection(access.store.id)
  ]);

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page max-w-none">
        <div>
          <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Integrations</h1>
          <p className="mt-2 text-sm text-[#737582]">
            StoreOS AI answers questions about this store — how today went, what is running low,
            which products are selling. To do that it needs to read your data, and an API key is how
            you let it. Keys are read-only, you choose what each one can see, and you can revoke any
            of them at any time.
          </p>
          {!access.canManage ? (
            <p className="mt-3 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
              You can see which keys exist, but only the store owner or an admin can create or
              revoke one.
            </p>
          ) : null}
        </div>

        <AiIntegrationSettings
          canManage={access.canManage}
          connection={{
            isConfigured: isStoreOSConfigured(),
            lastSyncedAt: connection?.lastSyncedAt?.toISOString() ?? null,
            status: connection?.status ?? null
          }}
          createAction={createAiApiKeyAction}
          // Only what can be granted today reaches the browser, so a write scope
          // is not a checkbox somebody has to be stopped from ticking.
          grantableScopes={AI_SCOPES.filter(isGrantableScope)}
          keys={keys}
          revokeAction={revokeAiApiKeyAction}
        />
      </section>
    </DashboardShell>
  );
}
