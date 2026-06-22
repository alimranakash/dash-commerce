import { isStoreOSConfigured } from "@dash/storeos-sdk";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { AIChat } from "../../../modules/storeos/components/ai-chat";
import { StoreOSConnectionPanel } from "../../../modules/storeos/components/storeos-connection-panel";
import { reconnectStoreOSAction, sendStoreOSChatMessageAction } from "../../../modules/storeos/storeos.actions";
import { getStoreOSConnection } from "../../../modules/storeos/storeos.service";
import { requireStore } from "../../../modules/stores/queries";

const suggestedPrompts = [
  "আজ কত অর্ডার এসেছে?",
  "এই মাসে মোট বিক্রি কত?",
  "কম স্টক পণ্যগুলো দেখাও",
  "সেরা বিক্রিত পণ্য কোনগুলো?"
];

export default async function AIAssistantPage() {
  const store = await requireStore();
  const connection = await getStoreOSConnection(store.id);
  const initialMessage =
    connection?.status === "connected"
      ? "I am connected to StoreOS. Ask me about your store operations."
      : "StoreOS AI Assistant is not connected yet. You can still preview the chat, but responses will use a safe fallback until StoreOS is configured.";

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">AI Assistant</p>
            <h1>Dash AI for StoreOS</h1>
            <p className="auth-copy">
              Ask operational questions about orders, sales, inventory, and store health.
            </p>
          </div>
        </div>
        <div className="dashboard-shell">
          <StoreOSConnectionPanel
            action={reconnectStoreOSAction}
            connection={connection ? {
              lastSyncedAt: connection.lastSyncedAt?.toISOString() ?? null,
              status: connection.status,
              storeosConnectionId: connection.storeosConnectionId
            } : null}
            isConfigured={isStoreOSConfigured()}
          />
        </div>
        <div className="dashboard-shell ai-shell">
          <AIChat
            action={sendStoreOSChatMessageAction}
            initialMessage={initialMessage}
            suggestedPrompts={suggestedPrompts}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
