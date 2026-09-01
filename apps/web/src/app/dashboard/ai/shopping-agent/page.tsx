import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { storeSubdomain } from "../../../../lib/host-routing";
import { getAiSettingsView } from "../../../../modules/ai-provider/ai-provider.service";
import { ShoppingAgentConsole } from "../../../../modules/shopping-agent/components/shopping-agent-console";
import { saveShoppingAgentSettingsAction } from "../../../../modules/shopping-agent/shopping-agent.actions";
import { getShoppingAgentCapability } from "../../../../modules/shopping-agent/shopping-agent.service";
import { getStoreAccess } from "../../../../modules/stores/queries";

/**
 * Dashboard → StoreIM AI → AI Shopping Agent.
 *
 * Its own page rather than a card on StoreIM AI > Settings, because it is the
 * only AI surface a seller's *customers* ever meet. Settings answers "which
 * engine writes for me"; this answers "is there an assistant standing in my shop
 * right now, and what is it allowed to do" — a different question, and the one a
 * seller comes looking for by name.
 *
 * Everything below the header is one client component. The status, the switch
 * and the save state are three views of the same facts, and a page that rendered
 * the first on the server and the rest on the client showed them disagreeing for
 * as long as it took the seller to reload — see `shopping-agent-console.tsx`.
 * This file's whole job is to read those facts once and hand them over.
 *
 * `getStoreAccess()` rather than `requireStore()`, matching the sibling AI
 * pages: a member may read whether the assistant is live, while the switch is a
 * manager's and `saveShoppingAgentSettingsAction` refuses anyone else.
 */
export default async function AiShoppingAgentPage() {
  const access = await getStoreAccess();
  const [settings, capability] = await Promise.all([
    getAiSettingsView(access.store.id),
    getShoppingAgentCapability(access.store.id)
  ]);

  return (
    <DashboardShell storeSlug={access.store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">StoreIM AI</p>
            <h1>AI Shopping Agent</h1>
            <p className="auth-copy">
              A shopping assistant on your storefront. Customers describe what they want, it finds
              it in your catalogue, compares the options, and can take them through to a placed
              order.
            </p>
          </div>
        </div>

        <ShoppingAgentConsole
          action={saveShoppingAgentSettingsAction}
          canManage={access.canManage}
          capability={capability}
          settings={settings}
          storeName={access.store.name}
          storefrontUrl={`https://${storeSubdomain(access.store.slug)}`}
        />
      </section>
    </DashboardShell>
  );
}
