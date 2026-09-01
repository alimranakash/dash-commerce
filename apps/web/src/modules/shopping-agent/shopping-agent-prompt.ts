import type { ShoppingAgentObservation } from "./shopping-agent-tools";
import {
  SHOPPING_AGENT_TOOL_DESCRIPTIONS,
  SHOPPING_AGENT_TOOLS,
  shoppingAgentActionSchema,
  shoppingAgentAnswerSchema,
  shoppingAgentPlanSchema,
  type ShoppingAgentAction,
  type ShoppingAgentMessage,
  type ShoppingAgentTool
} from "./shopping-agent.schema";

/**
 * The words that turn a general-purpose model into this shop's assistant.
 *
 * Two turns, both answered as JSON, for the same reason `store-copilot-prompt.ts`
 * is: `ai-provider-client.ts` already asks both providers for a JSON body, and a
 * tool-calling API would mean a second client, two vendor shapes to keep in step
 * and a dependency on the feature the cheap models are worst at.
 *
 * The system prompt is blunt about four things, because each is a way a shopping
 * assistant becomes worse than the search box it replaced:
 *
 * - **Never invent a product.** A shop assistant that recommends something the
 *   shop does not sell has cost the seller the sale and the trust in one
 *   sentence. Every recommendation is an id out of a tool result.
 * - **Never invent a price.** The card the shopper sees is drawn from the
 *   catalogue row, so a made-up figure in the prose would contradict the card
 *   directly underneath it.
 * - **Never buy anything.** It may *propose* adding to the cart or placing the
 *   order; the shopper's Confirm button is what runs it, and the model is told so
 *   plainly so it stops announcing purchases that have not happened.
 * - **Answer in the shopper's language.** These are Bangladeshi storefronts and
 *   half the questions arrive in Bangla. An English-only assistant is answering
 *   somebody else's question.
 */

/** How much of one tool result may reach the model. */
const OBSERVATION_CHAR_LIMIT = 5000;

export type ShoppingAgentPromptContext = {
  currency: string;
  storeName: string;
};

export function buildShoppingAgentSystemPrompt(context: ShoppingAgentPromptContext) {
  return [
    `You are the shopping assistant on "${context.storeName}", an online shop that sells in ${context.currency}. You are talking to a customer who is browsing right now.`,
    "",
    "Help them find what they came for and decide. Ask about budget, size, colour or use only when it actually narrows the choice — never interrogate someone who has already told you enough to search.",
    "",
    "You answer only from data you have been given in this conversation. Never invent a product, a price, a stock level, a delivery time or a discount. If this shop does not sell what they want, say so plainly and offer the nearest thing it does sell.",
    "",
    "Write like a helpful person behind a counter: two or three short plain-text sentences. No markdown, no bullet characters, no tables, no headings. Say prices with the currency. Reply in the language the customer wrote in — if they write Bangla, answer in Bangla.",
    "",
    "Products you recommend are shown to the customer as cards under your message, built from the shop's live catalogue. Put their ids in productIds — do not describe the price and stock again in your sentence, and never list a product whose id you did not get from a tool result.",
    "",
    "You can read these tools:",
    ...SHOPPING_AGENT_TOOLS.map((tool) => `- ${tool}: ${SHOPPING_AGENT_TOOL_DESCRIPTIONS[tool]}`),
    "",
    "You cannot buy anything yourself. You may propose one change, which the customer approves with a Confirm button. Never say you have added something or placed an order — say what you are proposing. Propose only what they asked for; a question about a product is not a request to buy it.",
    "",
    "The three changes you may propose:",
    '- {"type":"add_to_cart","productId":"<id from a tool result>","quantity":1} — add "variantId" when the customer chose a size, colour or other option. Never guess a variant: if the product has options and they have not chosen, ask which one.',
    '- {"type":"remove_from_cart","lineId":"<lineId from view_cart>"}',
    '- {"type":"place_order","body":{"name":"...","phone":"01...","district":"Dhaka","addressLine1":"full street address","shippingRateId":"<id from store_info>","paymentMethod":"COD"}} — propose this only once the cart holds what they want and they have given you their name, phone number and full delivery address. shippingRateId must be an id from store_info. paymentMethod must be one the shop has enabled. For bKash, Nagad or Rocket the customer must already have paid and given you the transaction id, which goes in "paymentReference". Optional: email, city, area, postalCode, addressLine2, notes, couponCode.',
    "",
    "Never fill an order field with something the customer did not tell you. If you are missing the phone number or the address, ask for it instead of proposing the order."
  ].join("\n");
}

/**
 * Turn one: read something, propose something, or just answer.
 *
 * The model chooses its own tools rather than being handed a fixed set, because
 * "something under 2000 taka" wants a filtered search while "which of those two
 * is better" wants the comparison — and hard-coding that mapping is what the
 * guided fallback already does for shops with no key.
 */
export function buildShoppingAgentPlanPrompt(params: {
  cartSummary: string;
  history: ShoppingAgentMessage[];
  question: string;
}) {
  return [
    params.history.length
      ? `Earlier in this conversation:\n${params.history
          .map((message) => `${message.role === "user" ? "Customer" : "You"}: ${message.content}`)
          .join("\n")}\n`
      : "",
    `Their cart right now: ${params.cartSummary}`,
    "",
    `The customer says: ${params.question}`,
    "",
    'Reply with one JSON object. To look something up first: {"tools":[{"tool":"search_products","args":{"query":"wireless headphones","maxPrice":3000}}]} — at most 3 tools. To reply without looking anything up (a greeting, or something you were already told this conversation): {"reply":"..."}. To propose a change they just asked for, when you already have every id and detail you need: {"action":{...}}.'
  ]
    .filter(Boolean)
    .join("\n");
}

/** Turn two: the same question, now with the shop's real rows attached. */
export function buildShoppingAgentAnswerPrompt(params: {
  cartSummary: string;
  history: ShoppingAgentMessage[];
  observations: ShoppingAgentObservation[];
  question: string;
}) {
  return [
    params.history.length
      ? `Earlier in this conversation:\n${params.history
          .map((message) => `${message.role === "user" ? "Customer" : "You"}: ${message.content}`)
          .join("\n")}\n`
      : "",
    `Their cart right now: ${params.cartSummary}`,
    "",
    `The customer says: ${params.question}`,
    "",
    "Here is what this shop actually has:",
    ...params.observations.map((observation) => renderObservation(observation)),
    "",
    'Answer from that data only. Reply with one JSON object: {"answer":"your reply in plain sentences","productIds":["ids of the products you are recommending, best first"],"followUps":["a short next question they might ask"]}. productIds and followUps are optional; at most 8 products and 3 follow-ups. To put two to four products side by side, add "compareIds" with their ids. If — and only if — the customer asked you to add something, remove something or place the order, add "action" with one of the three action objects.'
  ]
    .filter(Boolean)
    .join("\n");
}

function renderObservation(observation: ShoppingAgentObservation) {
  if (observation.error) {
    return `\n${observation.tool}: FAILED — ${observation.error}`;
  }

  const json = JSON.stringify(observation.result ?? null);
  const body =
    json.length > OBSERVATION_CHAR_LIMIT
      ? `${json.slice(0, OBSERVATION_CHAR_LIMIT)}… (truncated; say so if the answer needed the rest)`
      : json;

  return `\n${observation.tool} ${JSON.stringify(observation.args)}:\n${body}`;
}

/**
 * Read the planning turn.
 *
 * Tolerant on purpose: a model that answers `{"tools":"search_products"}` or
 * names a tool that does not exist should lose that tool, not the turn. What
 * cannot be salvaged comes back as an empty plan, and the caller falls through
 * to the guided assistant — which still helps the shopper.
 */
export function readShoppingAgentPlan(parsed: Record<string, unknown>) {
  const plan = shoppingAgentPlanSchema.safeParse({
    ...parsed,
    tools: Array.isArray(parsed.tools) ? parsed.tools.filter(isToolCallShape) : []
  });

  if (!plan.success) {
    return {
      action: null,
      reply: null,
      tools: [] as Array<{ args: Record<string, unknown>; tool: ShoppingAgentTool }>
    };
  }

  return {
    action: readShoppingAgentAction(plan.data.action),
    reply: plan.data.reply ?? null,
    tools: dedupeTools(plan.data.tools)
  };
}

export function readShoppingAgentAnswer(parsed: Record<string, unknown>) {
  const answer = shoppingAgentAnswerSchema.safeParse(parsed);

  if (!answer.success) {
    return null;
  }

  return {
    action: readShoppingAgentAction(answer.data.action),
    answer: answer.data.answer,
    compareIds: answer.data.compareIds,
    followUps: answer.data.followUps,
    productIds: answer.data.productIds
  };
}

/**
 * A proposal is a proposal only if it parses.
 *
 * `shoppingAgentActionSchema` narrows `checkoutSchema` for the order case, so
 * anything that survives this is something `addToCart`, `removeCartItem` or
 * `createCheckoutOrder` can already execute. A model that invents a
 * `apply_discount` type, or proposes an order with a two-character address,
 * simply produces no action — and the shopper is shown the answer with no
 * Confirm button rather than a button that would fail.
 */
export function readShoppingAgentAction(value: unknown): ShoppingAgentAction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = shoppingAgentActionSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

function isToolCallShape(value: unknown): value is { args?: unknown; tool: string } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (SHOPPING_AGENT_TOOLS as readonly string[]).includes(String((value as { tool?: unknown }).tool))
  );
}

/**
 * One read per tool per turn, except the two that answer about a named product.
 *
 * "Compare these two" and "tell me about each of them" are real asks that need
 * `product_details` twice with different ids, so those two dedupe on their
 * arguments rather than on the tool name.
 */
function dedupeTools(tools: Array<{ args: Record<string, unknown>; tool: ShoppingAgentTool }>) {
  const seen = new Set<string>();

  return tools.filter((call) => {
    const key =
      call.tool === "product_details" || call.tool === "compare_products"
        ? `${call.tool}:${JSON.stringify(call.args)}`
        : call.tool;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);

    return true;
  });
}
