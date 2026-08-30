import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { AIChat } from "../../../modules/storeos/components/ai-chat";
import { sendStoreOSChatMessageAction } from "../../../modules/storeos/storeos.actions";
import { getStoreOSConnectionView } from "../../../modules/storeos/storeos.service";
import { requireStore } from "../../../modules/stores/queries";

const suggestedPrompts = [
  "আজ কত অর্ডার এসেছে?",
  "এই মাসে মোট বিক্রি কত?",
  "কম স্টক পণ্যগুলো দেখাও",
  "সেরা বিক্রিত পণ্য কোনগুলো?"
];

/**
 * Dashboard → Dash AI → Chat Agent.
 *
 * Just the conversation. The connection panel that used to sit above it now
 * lives on Dash AI > Settings — a manager's control read once during setup, and
 * it was taking the top of a screen whose whole job is the chat.
 *
 * What is left of it here is one line: when the store is not connected, the
 * chat says so and links to the page that fixes it. That is the only moment the
 * connection is worth a reader's attention on this screen.
 */
export default async function AIAssistantPage() {
  const store = await requireStore();
  const connection = await getStoreOSConnectionView(store.id);
  const isConnected = connection.phase === "connected";
  const initialMessage = isConnected
    ? "I am connected and ready. Ask me about your store operations."
    : "Dash AI is not connected yet. You can still preview the chat, but responses will use a safe fallback until the connection is made.";

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Dash AI</p>
            <h1>Chat Agent</h1>
            <p className="auth-copy">
              Ask operational questions about orders, sales, inventory, and store health.
            </p>
          </div>
        </div>

        {!isConnected ? (
          <p className="m-0 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
            {connection.detail}{" "}
            <Link className="font-semibold underline" href="/dashboard/ai/settings">
              Open Dash AI settings
            </Link>{" "}
            to connect it.
          </p>
        ) : null}

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
