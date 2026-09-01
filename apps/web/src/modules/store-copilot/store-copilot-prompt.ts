import {
  STORE_COPILOT_TOOL_DESCRIPTIONS,
  STORE_COPILOT_TOOLS,
  storeCopilotActionSchema,
  storeCopilotAnswerSchema,
  storeCopilotPlanSchema,
  type StoreCopilotAction,
  type StoreCopilotMessage,
  type StoreCopilotTool
} from "./store-copilot.schema";
import type { StoreCopilotObservation } from "./store-copilot-tools";

/**
 * The words that turn a general-purpose model into this store's manager.
 *
 * Two turns, both answered as JSON, because that is what
 * `ai-provider-client.ts` asks both providers for — Gemini with
 * `responseMimeType: application/json` and OpenAI with
 * `response_format: json_object`. A tool-calling API would be the other way to
 * do this and would mean a second client, two vendor-specific shapes to keep in
 * step, and a dependency on a feature the cheaper models are worst at. One JSON
 * object per turn works on every model either provider offers.
 *
 * The system prompt is deliberately blunt about three things, because each one
 * is a way an assistant like this becomes worse than useless:
 *
 * - **Never invent a number.** An assistant that guesses last month's revenue is
 *   more dangerous than one that says it could not read it.
 * - **Never execute.** It may *propose* a change; the merchant's Confirm button
 *   is what runs it, and the model is told so plainly so it stops promising to
 *   have done things.
 * - **Answer in the merchant's language.** The suggested prompts on this page
 *   are Bangla, the storefronts are Bangladeshi, and an English-only assistant
 *   would be answering a different question than the one asked.
 */

/** How much of one tool result may reach the model. Reports are the big ones. */
const OBSERVATION_CHAR_LIMIT = 6000;

export type StoreCopilotPromptContext = {
  currency: string;
  storeName: string;
  /** `YYYY-MM-DD` in the store's own timezone, so "expiring in a week" lands right. */
  today: string;
  timezone: string;
};

export function buildStoreCopilotSystemPrompt(context: StoreCopilotPromptContext) {
  return [
    `You are the AI Store Copilot for "${context.storeName}", an online store selling in ${context.currency}.`,
    `Today is ${context.today} in the store's timezone (${context.timezone}).`,
    "",
    "You help the merchant understand and run their own store. You answer only from data you have been given in this conversation. If a number is not in the data, say you could not read it — never estimate, never carry a figure over from a previous answer, and never invent an order, product, customer or total.",
    "",
    "Write like a capable shop manager, not a report generator: a few short plain-text sentences, the figure first, then what it means. No markdown, no tables, no bullet characters, no headings. Always give money with its currency. Reply in the same language the merchant wrote in — if they write Bangla, answer in Bangla.",
    "",
    "You can read these tools:",
    ...STORE_COPILOT_TOOLS.map((tool) => `- ${tool}: ${STORE_COPILOT_TOOL_DESCRIPTIONS[tool]}`),
    "",
    "You cannot change anything yourself. You may only propose one change, which the merchant then approves with a Confirm button. Never say you have created, updated or changed something — say what you are proposing. Propose a change only when the merchant clearly asked for one; a question is not a request to act.",
    "",
    "The three changes you may propose:",
    '- {"type":"create_coupon","body":{"code":"EID10","name":"Eid discount","discountType":"PERCENTAGE","discountValue":"10","expiresAt":"YYYY-MM-DD","usageLimitTotal":100}} — discountType is "PERCENTAGE", "FIXED_CART" or "FREE_SHIPPING". discountValue is a number as a string, at most 2 decimals, and 0-100 for a percentage. code is letters, digits, dashes and underscores. name is required. expiresAt and usageLimitTotal are optional.',
    '- {"type":"update_product","productId":"<id from list_products>","body":{"price":"1200","stockQuantity":40,"status":"ACTIVE"}} — only include the fields being changed. Allowed: title, description, shortDescription, price, compareAtPrice, stockQuantity, status ("ACTIVE"/"DRAFT"/"ARCHIVED"), visibility ("PUBLIC"/"HIDDEN"), seoTitle, metaDescription, keywords, features, socialCaption.',
    '- {"type":"update_order_status","orderId":"<id from list_orders>","status":"PROCESSING"} — status is "PROCESSING", "COMPLETED" or "CANCELLED".',
    "",
    "Use a real id from a tool result for productId and orderId. If you do not have the id yet, read the list first instead of guessing one."
  ].join("\n");
}

/**
 * Turn one: read something, propose something, or just answer.
 *
 * The model is asked for the tools *it* thinks it needs rather than being handed
 * a fixed set, because the same question ("how are we doing?") deserves the
 * overview while "who bought the most this year" deserves the customers report,
 * and hard-coding that mapping is what the deterministic briefing already does
 * for stores with no key.
 */
export function buildStoreCopilotPlanPrompt(params: {
  history: StoreCopilotMessage[];
  question: string;
}) {
  return [
    params.history.length
      ? `Earlier in this conversation:\n${params.history
          .map((message) => `${message.role === "user" ? "Merchant" : "You"}: ${message.content}`)
          .join("\n")}\n`
      : "",
    `The merchant asks: ${params.question}`,
    "",
    'Reply with one JSON object. To read data first: {"tools":[{"tool":"store_overview","args":{}}]} — at most 4 tools, and prefer store_overview when the question is general. To answer without reading anything (a greeting, or something you were already told this conversation): {"reply":"..."}. To propose a change the merchant just asked for, when you already have the ids you need: {"action":{...}}.'
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Turn two: the same question, now with the store's real rows attached.
 *
 * The observations are handed over as the JSON the services returned, not as
 * prose. Summarising them here would mean this file deciding which fields
 * matter, and it is the model's job to pick out the two numbers that answer the
 * question from the twenty it was given.
 */
export function buildStoreCopilotAnswerPrompt(params: {
  history: StoreCopilotMessage[];
  observations: StoreCopilotObservation[];
  question: string;
}) {
  return [
    params.history.length
      ? `Earlier in this conversation:\n${params.history
          .map((message) => `${message.role === "user" ? "Merchant" : "You"}: ${message.content}`)
          .join("\n")}\n`
      : "",
    `The merchant asks: ${params.question}`,
    "",
    "Here is the live data from their store:",
    ...params.observations.map((observation) => renderObservation(observation)),
    "",
    'Answer from that data only. Reply with one JSON object: {"answer":"your reply in plain sentences","followUps":["a short next question","another"]}. followUps is optional and at most 3 short questions the merchant might ask next. If — and only if — the merchant asked you to make a change, add "action" with one of the three action objects.'
  ]
    .filter(Boolean)
    .join("\n");
}

function renderObservation(observation: StoreCopilotObservation) {
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
 * Tolerant on purpose: a model that answers `{"tools":"store_overview"}` or
 * names a tool that does not exist should lose that tool, not the turn. What
 * cannot be salvaged comes back as an empty plan, and the caller falls through
 * to the deterministic briefing — which still answers the merchant.
 */
export function readStoreCopilotPlan(parsed: Record<string, unknown>) {
  const plan = storeCopilotPlanSchema.safeParse({
    ...parsed,
    tools: Array.isArray(parsed.tools) ? parsed.tools.filter(isToolCallShape) : []
  });

  if (!plan.success) {
    return {
      action: null,
      reply: null,
      tools: [] as Array<{ args: unknown; tool: StoreCopilotTool }>
    };
  }

  return {
    action: readStoreCopilotAction(plan.data.action),
    reply: plan.data.reply ?? null,
    tools: dedupeTools(plan.data.tools)
  };
}

export function readStoreCopilotAnswer(parsed: Record<string, unknown>) {
  const answer = storeCopilotAnswerSchema.safeParse(parsed);

  if (!answer.success) {
    return null;
  }

  return {
    action: readStoreCopilotAction(answer.data.action),
    answer: answer.data.answer,
    followUps: answer.data.followUps
  };
}

/**
 * A proposal is a proposal only if it parses.
 *
 * `storeCopilotActionSchema` is built from the AI API's own body schemas, so
 * anything that survives this is something `createAiCoupon`, `updateAiProduct`
 * or `setAiOrderStatus` can execute — a model that invents a `delete_product`
 * type or a 150% discount simply produces no action, and the merchant is shown
 * the answer without a Confirm button rather than a button that would fail.
 */
export function readStoreCopilotAction(value: unknown): StoreCopilotAction | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const parsed = storeCopilotActionSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

function isToolCallShape(value: unknown): value is { args?: unknown; tool: string } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (STORE_COPILOT_TOOLS as readonly string[]).includes(String((value as { tool?: unknown }).tool))
  );
}

/** One read per tool per turn. A model asking for orders twice gets them once. */
function dedupeTools(tools: Array<{ args: Record<string, unknown>; tool: StoreCopilotTool }>) {
  const seen = new Set<StoreCopilotTool>();

  return tools.filter((call) => {
    if (seen.has(call.tool)) {
      return false;
    }

    seen.add(call.tool);

    return true;
  });
}
