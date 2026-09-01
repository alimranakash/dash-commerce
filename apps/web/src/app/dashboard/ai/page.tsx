import { KeyRound, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { StoreCopilotChat } from "../../../modules/store-copilot/components/store-copilot-chat";
import {
  askStoreCopilotAction,
  runStoreCopilotActionAction
} from "../../../modules/store-copilot/store-copilot.actions";
import { getStoreCopilotCapability } from "../../../modules/store-copilot/store-copilot.service";
import { requireStore } from "../../../modules/stores/queries";

/**
 * Dashboard → StoreIM AI → AI Store Copilot.
 *
 * Ask about sales, orders, products, customers or stock and get an answer built
 * from this store's own rows, plus a Confirm button for the three changes the
 * assistant may propose.
 *
 * Every figure comes from `modules/ai/*.service.ts`, the same read layer behind
 * the external AI API and the dashboard's own numbers, so the assistant cannot
 * quote a total the home page disagrees with. The conversation itself runs on
 * the merchant's own Gemini or OpenAI key; a store without one still gets real
 * answers, assembled from the same figures without a model, and every reply says
 * which of the two it was.
 *
 * StoreIM AI is a paid entitlement, and a store qualifies either through its
 * plan or through its own provider key — the same rule the Product Content
 * Studio applies, because a merchant paying their own model bill is not
 * something a plan should stand in the way of. What renders here follows from
 * that: an upgrade panel when neither holds, the key prompt when the plan does
 * the work, and the chat itself otherwise.
 *
 * None of it is the enforcement. `askStoreCopilot` and
 * `runStoreCopilotActionAction` re-resolve both the credential and the
 * entitlement server-side, so hiding the chat is a courtesy and refusing the
 * request is the gate.
 */

/**
 * The starting chips, in both languages the dashboard is used in.
 *
 * The coupon prompt is only offered to a store that can actually hold the
 * conversation: the offline briefing answers questions from figures but cannot
 * draft a discount, and a chip that quietly does something else is worse than no
 * chip at all.
 */
const READ_PROMPTS = [
  "How did we do today?",
  "Which products are low on stock?",
  "আজ কত অর্ডার এসেছে?",
  "সেরা বিক্রিত পণ্য কোনগুলো?"
];

const ACTION_PROMPT = "Create a 10% coupon for Eid";

export default async function AIAssistantPage() {
  const store = await requireStore();
  const capability = await getStoreCopilotCapability(store.id);
  const canChat = !capability.locked;
  const intro = capability.ready
    ? `I can see ${store.name}'s live data. Ask me about sales, orders, products, customers or stock — or ask me to create a discount code and I will show it to you before anything happens.`
    : `I can answer from ${store.name}'s live figures right now. Add your own Gemini or OpenAI key in StoreIM AI settings and I can hold a proper conversation about them.`;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">StoreIM AI</p>
            <h1>AI Store Copilot</h1>
            <p className="auth-copy">
              Ask anything about your shop — answered from your live store data. Changes are
              proposed for you to approve, and nothing is written until you confirm it.
            </p>
          </div>
          <span className={`copilot-engine${capability.ready ? " is-ready" : ""}`}>
            <Sparkles aria-hidden="true" className="h-3.5 w-3.5" />
            {capability.ready ? `Running on ${capability.providerLabel}` : "No AI key yet"}
          </span>
        </div>

        {capability.locked ? (
          <div className="copilot-callout">
            <Lock aria-hidden="true" className="h-5 w-5 shrink-0" />
            <div className="copilot-callout-body">
              <strong>The AI Store Copilot is not included in your plan.</strong>
              <p>
                Upgrade to unlock it. Your own Gemini or OpenAI key decides which engine writes the
                answers once you have it — it is not a way to open the Copilot on a plan that does
                not include it.
              </p>
            </div>
            <Link className="copilot-callout-action" href="/dashboard/billing">
              See plans
            </Link>
          </div>
        ) : null}

        {canChat && !capability.ready ? (
          <div className="copilot-callout">
            <KeyRound aria-hidden="true" className="h-5 w-5 shrink-0" />
            <div className="copilot-callout-body">
              <strong>Answers are coming straight from your dashboard figures.</strong>
              <p>
                Add your own Gemini or OpenAI key and the Store Copilot can answer follow-up
                questions in your own words, in English or Bangla, and draft changes for you to
                approve. The key is yours and is billed to your own account.
              </p>
            </div>
            <Link className="copilot-callout-action" href="/dashboard/ai/settings">
              Add a key
            </Link>
          </div>
        ) : null}

        {canChat ? (
          <div className="ai-shell">
            <StoreCopilotChat
              ask={askStoreCopilotAction}
              engineLabel={capability.providerLabel}
              intro={intro}
              run={runStoreCopilotActionAction}
              suggestedPrompts={capability.ready ? [...READ_PROMPTS, ACTION_PROMPT] : READ_PROMPTS}
            />
          </div>
        ) : null}
      </section>
    </DashboardShell>
  );
}
