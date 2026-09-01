import { isShoppingAgentEnabled } from "../../ai-provider/ai-provider.service";
import { askShoppingAgentAction, runShoppingAgentActionAction } from "../shopping-agent.actions";
import { getShoppingAgentCapability } from "../shopping-agent.service";
import { ShoppingAgentWidget } from "./shopping-agent-widget";

/**
 * Whether this shop gets a shopping assistant, decided on the server.
 *
 * Mounted once from the storefront layout, so the widget follows the shopper
 * across the home page, a category, a product and the cart without remounting or
 * losing the conversation. It renders nothing at all — no launcher, no bundle
 * weight beyond this component — for a shop that has not switched it on or is
 * not entitled to it, which is the common case and the one that must cost
 * nothing.
 *
 * The two server actions are passed down as props rather than imported by the
 * widget. That is what keeps the client bundle free of `shopping-agent.service`
 * and everything it drags in — Prisma, the checkout service, the provider
 * client and the decryption key that goes with it.
 */
export async function ShoppingAgentDock({
  store
}: {
  store: { currency: string; id: string; name: string; slug: string };
}) {
  // The cheap half first, because this runs on every storefront page of every
  // shop and almost all of them have the assistant off. One row settles it; the
  // plan read and the credential resolve behind `getShoppingAgentCapability` only
  // happen for a shop that has actually asked for the widget.
  if (!(await isShoppingAgentEnabled(store.id))) {
    return null;
  }

  const capability = await getShoppingAgentCapability(store.id);

  if (!capability.enabled || !capability.entitled) {
    return null;
  }

  return (
    <ShoppingAgentWidget
      ask={askShoppingAgentAction}
      currency={store.currency}
      engineLabel={capability.providerLabel}
      run={runShoppingAgentActionAction}
      storeName={store.name}
      storeSlug={store.slug}
      suggestedPrompts={SUGGESTED_PROMPTS}
    />
  );
}

/**
 * The opening chips.
 *
 * One of each kind of question the agent is actually good at — an open browse, a
 * budget, a comparison and the basket — because a shopper who does not know what
 * a chat box can do will type "hi" and leave. Bangla is not mixed in here the
 * way it is on the merchant-facing copilot: the shopper's own language is
 * unknown until they write, and the agent answers in whichever one they use.
 */
const SUGGESTED_PROMPTS = [
  "What do you sell?",
  "Show me something under 2000",
  "Help me compare two of these",
  "What is in my cart?"
];
