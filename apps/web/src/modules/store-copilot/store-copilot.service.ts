import {
  AiProviderError,
  parseJsonObject,
  requestGeminiCompletion,
  requestOpenAiCompletion
} from "../ai-provider/ai-provider-client";
import { AI_PROVIDER_META } from "../ai-provider/ai-provider.schema";
import { resolveAiProvider, type ResolvedAiProvider } from "../ai-provider/ai-provider.service";
import {
  createAiCoupon,
  setAiOrderStatus,
  updateAiProduct,
  type AiActor
} from "../ai/ai-actions.service";
import { hasPlanFeature } from "../billing/subscription-limits";
import { consumeAiApiToken } from "../ai/ai-rate-limit";
import { AiApiRouteError } from "../ai/ai-route";
import { CouponError } from "../coupons/coupon.service";
import { getOrderByIdForStore } from "../orders/order.service";
import { getProductByIdForStore } from "../products/product.repository";
import { getStoreIdentityById } from "../stores/store.repository";
import { composeStoreCopilotBriefing } from "./store-copilot-briefing";
import {
  buildStoreCopilotAnswerPrompt,
  buildStoreCopilotPlanPrompt,
  buildStoreCopilotSystemPrompt,
  readStoreCopilotAnswer,
  readStoreCopilotPlan
} from "./store-copilot-prompt";
import { runStoreCopilotTool, type StoreCopilotObservation } from "./store-copilot-tools";
import {
  STORE_COPILOT_ACTION_LABELS,
  storeCopilotAskSchema,
  type StoreCopilotAction,
  type StoreCopilotActionPreview,
  type StoreCopilotAskInput,
  type StoreCopilotMessage,
  type StoreCopilotReply
} from "./store-copilot.schema";

/**
 * The AI Store Copilot.
 *
 * One turn of the chat is: decide what to read, read it through the shared AI
 * read services, and answer from what came back. The model never touches the
 * database and never performs a write — it names tools from a closed enum and,
 * at most, *proposes* one change that the merchant executes with a button.
 *
 * ## Which engine answers
 *
 * 1. The store's **own Gemini or OpenAI key**, set in StoreIM AI > Settings. The
 *    same credential the Product Content Studio uses, resolved by the same
 *    `resolveAiProvider`, which is still the only function in the codebase that
 *    decrypts it.
 * 2. The **deterministic briefing**, which reads the same tools and states the
 *    same numbers without a model.
 *
 * There is no third engine, and in particular no platform-side model: this
 * feature spends the merchant's own credential or nothing at all.
 *
 * ## Who may use it
 *
 * StoreIM AI is a paid entitlement, and the gate here is the same one
 * `canGenerateProductContent` applies, so both AI surfaces answer the question
 * identically: a store qualifies through **its own provider key**, or through a
 * **plan that grants `ai`**. A key the seller bought is never plan-gated — they
 * are paying the model bill — while the deterministic briefing is what the
 * platform sells, so it is what the plan buys. A store with neither is told so
 * rather than quietly answered.
 *
 * ## Why the fallback is not an error path
 *
 * A rate-limited key at 9pm, a model that answered in prose, a provider outage —
 * each of those ends with the briefing and a warning sentence naming what
 * happened, never with a merchant staring at a failure. Every reply carries the
 * `source` that produced it, so a template answer is never passed off as AI.
 */

/** Two provider calls per turn at most, so the bucket is charged for both. */
const TURN_COST = 2;

/** Tool reads per turn. The plan schema already caps the model's ask at four. */
const MAX_TOOLS_PER_TURN = 4;

/** Shown to a store with neither a plan nor a key, on the page and in the chat. */
export const STORE_COPILOT_LOCKED_MESSAGE =
  "StoreIM AI is part of a paid plan. Upgrade to unlock it, or add your own Gemini or OpenAI key in StoreIM AI settings — a key you own works on any plan.";

export type StoreCopilotCapability = {
  /** Neither a provider key nor a plan that grants `ai`. Nothing will answer. */
  locked: boolean;
  /** The provider label for the UI, or null when there is no key. */
  providerLabel: string | null;
  ready: boolean;
};

/**
 * Whether this store can hold a conversation, for the page's banner.
 *
 * The page uses it to decide what to render — the chat, the key prompt, or the
 * upgrade panel. It is never the enforcement: `askStoreCopilot` re-resolves both
 * the credential and the entitlement itself rather than trusting a prop, so a
 * locked store that reaches the action anyway is still refused.
 */
export async function getStoreCopilotCapability(storeId: string): Promise<StoreCopilotCapability> {
  const [provider, planAllowsAi] = await Promise.all([
    resolveAiProvider(storeId),
    hasPlanFeature(storeId, "ai_copilot")
  ]);

  return {
    locked: !provider && !planAllowsAi,
    providerLabel: provider ? AI_PROVIDER_META[provider.provider].label : null,
    ready: provider !== null
  };
}

export async function askStoreCopilot(
  storeId: string,
  input: StoreCopilotAskInput
): Promise<StoreCopilotReply> {
  const data = storeCopilotAskSchema.parse(input);
  const throttle = consumeAiApiToken(`store-copilot:${storeId}`, TURN_COST);

  if (!throttle.allowed) {
    return {
      action: null,
      actionPreview: null,
      answer: `That is a lot of questions at once. Try again in about ${throttle.retryAfterSeconds} ${throttle.retryAfterSeconds === 1 ? "second" : "seconds"}.`,
      followUps: [],
      source: "offline",
      used: [],
      warnings: []
    };
  }

  const [provider, planAllowsAi] = await Promise.all([
    resolveAiProvider(storeId),
    hasPlanFeature(storeId, "ai_copilot")
  ]);

  // Re-checked here rather than trusted from the page, so the entitlement holds
  // for anything that can reach the server action.
  if (!provider && !planAllowsAi) {
    return {
      action: null,
      actionPreview: null,
      answer: STORE_COPILOT_LOCKED_MESSAGE,
      followUps: [],
      source: "offline",
      used: [],
      warnings: []
    };
  }

  if (!provider) {
    return briefingReply(storeId, data.message, [
      "This answer was assembled from your dashboard figures rather than written by AI. Add a Gemini or OpenAI key in StoreIM AI settings to ask follow-up questions in your own words."
    ]);
  }

  try {
    return await answerWithProvider({
      history: data.history,
      provider,
      question: data.message,
      storeId
    });
  } catch (error) {
    // The provider's own sentence is the useful half — it names the key or the
    // model, both of which the merchant controls in StoreIM AI settings. Anything
    // else stays in the server log.
    console.error("[store-copilot] provider turn failed:", error);

    return briefingReply(storeId, data.message, [
      error instanceof AiProviderError
        ? error.message
        : `${AI_PROVIDER_META[provider.provider].label} could not be reached, so this answer was assembled from your dashboard figures instead.`
    ]);
  }
}

async function answerWithProvider(params: {
  history: StoreCopilotMessage[];
  provider: ResolvedAiProvider;
  question: string;
  storeId: string;
}): Promise<StoreCopilotReply> {
  const { history, provider, question, storeId } = params;
  const store = await getStoreIdentityById(storeId);
  const system = buildStoreCopilotSystemPrompt({
    currency: store?.currency ?? "BDT",
    storeName: store?.name ?? "this store",
    timezone: store?.timezone ?? "Asia/Dhaka",
    today: todayInTimezone(store?.timezone ?? "Asia/Dhaka")
  });
  const call = provider.provider === "gemini" ? requestGeminiCompletion : requestOpenAiCompletion;
  const source = provider.provider;

  const planText = await call({
    apiKey: provider.apiKey,
    model: provider.model,
    system,
    user: buildStoreCopilotPlanPrompt({ history, question })
  });
  const planJson = parseJsonObject(planText);

  if (!planJson) {
    return briefingReply(storeId, question, [
      `${AI_PROVIDER_META[source].label} answered in a format this page could not read, so the figures below were assembled from your dashboard instead.`
    ]);
  }

  const plan = readStoreCopilotPlan(planJson);

  // An action proposed before any data was read is still a proposal — the
  // merchant confirms it, and `finaliseAction` has already checked that the
  // product or order it names is really theirs.
  if (plan.action && plan.tools.length === 0) {
    return finalise({
      action: plan.action,
      answer: plan.reply ?? "Here is the change I can make. Read it and confirm if it is right.",
      followUps: [],
      source,
      storeId,
      used: [],
      warnings: []
    });
  }

  if (plan.tools.length === 0 && plan.reply) {
    return finalise({
      action: null,
      answer: plan.reply,
      followUps: [],
      source,
      storeId,
      used: [],
      warnings: []
    });
  }

  const calls = plan.tools.slice(0, MAX_TOOLS_PER_TURN);
  const observations: StoreCopilotObservation[] = calls.length
    ? await Promise.all(calls.map((entry) => runStoreCopilotTool(storeId, entry.tool, entry.args)))
    : [await runStoreCopilotTool(storeId, "store_overview", {})];
  const used = observations.map((observation) => observation.tool);

  const answerText = await call({
    apiKey: provider.apiKey,
    model: provider.model,
    system,
    user: buildStoreCopilotAnswerPrompt({ history, observations, question })
  });
  const answerJson = parseJsonObject(answerText);
  const answer = answerJson ? readStoreCopilotAnswer(answerJson) : null;

  if (!answer) {
    return briefingReply(storeId, question, [
      `${AI_PROVIDER_META[source].label} answered in a format this page could not read, so the figures below were assembled from your dashboard instead.`
    ]);
  }

  return finalise({
    action: answer.action,
    answer: answer.answer,
    followUps: answer.followUps,
    source,
    storeId,
    used,
    warnings: observations
      .filter((observation) => observation.error)
      .map((observation) => `${observation.tool} could not be read, so it is not in this answer.`)
  });
}

async function briefingReply(
  storeId: string,
  question: string,
  warnings: string[]
): Promise<StoreCopilotReply> {
  const briefing = await composeStoreCopilotBriefing(storeId, question);

  return {
    action: null,
    actionPreview: null,
    answer: briefing.answer,
    followUps: briefing.followUps,
    source: "offline",
    used: briefing.used,
    warnings
  };
}

/**
 * Attach the confirmation card, or drop the proposal.
 *
 * A model that names a product id it invented, or one belonging to another
 * store, must not produce a Confirm button — the execution would 404 and the
 * merchant would have been shown a change that was never possible. So the target
 * is re-read, scoped by store, before the button exists at all.
 */
async function finalise(
  reply: Omit<StoreCopilotReply, "actionPreview"> & { storeId: string }
): Promise<StoreCopilotReply> {
  const { storeId, ...rest } = reply;

  if (!rest.action) {
    return { ...rest, actionPreview: null };
  }

  const preview = await describeStoreCopilotAction(storeId, rest.action);

  if (!preview) {
    return {
      ...rest,
      action: null,
      actionPreview: null,
      warnings: [
        ...rest.warnings,
        "A change was suggested for something this store does not have, so it was not offered."
      ]
    };
  }

  return { ...rest, actionPreview: preview };
}

/**
 * The proposal in the merchant's vocabulary.
 *
 * Returns null when the action names a target that is not in this store, which
 * is the check that keeps an invented id off the Confirm button.
 */
export async function describeStoreCopilotAction(
  storeId: string,
  action: StoreCopilotAction
): Promise<StoreCopilotActionPreview | null> {
  const label = STORE_COPILOT_ACTION_LABELS[action.type];

  if (action.type === "create_coupon") {
    const store = await getStoreIdentityById(storeId);
    const currency = store?.currency ?? "BDT";
    const { body } = action;

    return {
      label,
      rows: [
        { label: "Code", value: body.code.toUpperCase() },
        { label: "Name", value: body.name },
        { label: "Discount", value: describeDiscount(body, currency) },
        ...(body.minSubtotal
          ? [{ label: "Minimum spend", value: `${currency} ${body.minSubtotal}` }]
          : []),
        ...(body.startsAt ? [{ label: "Starts", value: body.startsAt }] : []),
        { label: "Expires", value: body.expiresAt ?? "No end date" },
        {
          label: "Total uses",
          value: body.usageLimitTotal ? String(body.usageLimitTotal) : "Unlimited"
        },
        ...(body.usageLimitPerCustomer
          ? [{ label: "Per customer", value: String(body.usageLimitPerCustomer) }]
          : []),
        { label: "Status", value: body.status === "ACTIVE" ? "Active immediately" : "Inactive" }
      ]
    };
  }

  if (action.type === "update_product") {
    const product = await getProductByIdForStore(storeId, action.productId);

    if (!product) {
      return null;
    }

    const rows = Object.entries(action.body)
      .filter(([, value]) => value !== undefined)
      .map(([field, value]) => ({
        label: PRODUCT_FIELD_LABELS[field] ?? field,
        value: value === null ? "Cleared" : String(value)
      }));

    return {
      label,
      rows: [{ label: "Product", value: product.title }, ...rows]
    };
  }

  const order = await getOrderByIdForStore(storeId, action.orderId);

  if (!order) {
    return null;
  }

  return {
    label,
    rows: [
      { label: "Order", value: order.orderNumber },
      { label: "Now", value: titleCase(order.status) },
      { label: "Change to", value: titleCase(action.status) }
    ]
  };
}

/**
 * Run the change the merchant confirmed.
 *
 * Straight through `ai-actions.service.ts` — the same three functions the
 * external AI API calls, which are themselves shells over `createCoupon`,
 * `updateProduct` and `updateOrderStatus`. So this path adds no write of its
 * own: every invariant, plan gate and side effect the dashboard's own buttons
 * trigger still happens, and each change lands in `SystemLog` with the merchant
 * who approved it named.
 *
 * The action is re-parsed by the caller and the target re-read here through
 * store-scoped functions, so a payload edited in the browser can still only do
 * what that merchant could do from their own dashboard.
 */
export async function executeStoreCopilotAction(params: {
  action: StoreCopilotAction;
  actor: AiActor;
  storeId: string;
}): Promise<string> {
  const { action, actor, storeId } = params;

  try {
    if (action.type === "create_coupon") {
      const created = await createAiCoupon({ actor, body: action.body, storeId });

      return `Coupon ${created.coupon.code} is live.`;
    }

    if (action.type === "update_product") {
      const updated = await updateAiProduct({
        actor,
        body: action.body,
        productId: action.productId,
        storeId
      });

      return `${updated.product.title} updated (${updated.changed.join(", ")}).`;
    }

    const result = await setAiOrderStatus({
      actor,
      body: { status: action.status },
      orderId: action.orderId,
      storeId
    });

    return result.previousStatus === result.status
      ? `Order ${result.orderNumber} was already ${titleCase(result.status)}.`
      : `Order ${result.orderNumber} is now ${titleCase(result.status)}.`;
  } catch (error) {
    // `CouponError` and `AiApiRouteError` are already sentences written for a
    // merchant — a duplicate code, an impossible date window, a product that is
    // not theirs. Anything else is not described to the browser.
    if (error instanceof CouponError || error instanceof AiApiRouteError) {
      throw new StoreCopilotActionError(error.message);
    }

    console.error("[store-copilot] action failed:", error);

    throw new StoreCopilotActionError(
      error instanceof Error && error.message
        ? error.message
        : "That change could not be made. Try it from the dashboard page instead."
    );
  }
}

export class StoreCopilotActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StoreCopilotActionError";
  }
}

const PRODUCT_FIELD_LABELS: Record<string, string> = {
  compareAtPrice: "Compare-at price",
  description: "Description",
  features: "Features",
  keywords: "Keywords",
  metaDescription: "Meta description",
  price: "Price",
  seoTitle: "SEO title",
  shortDescription: "Short description",
  socialCaption: "Social caption",
  status: "Status",
  stockQuantity: "Stock",
  title: "Title",
  visibility: "Visibility"
};

function describeDiscount(
  body: Extract<StoreCopilotAction, { type: "create_coupon" }>["body"],
  currency: string
) {
  if (body.discountType === "FREE_SHIPPING") {
    return "Free shipping";
  }

  return body.discountType === "PERCENTAGE"
    ? `${body.discountValue}% off`
    : `${currency} ${body.discountValue} off`;
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/**
 * `YYYY-MM-DD` where the merchant is, not where the server is.
 *
 * A coupon "expiring next Friday" written against UTC is a coupon that dies six
 * hours early in Dhaka. `en-CA` is used because it formats as ISO; the timezone
 * is the store's own column, and an unrecognised one falls back rather than
 * throwing inside a chat turn.
 */
function todayInTimezone(timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      day: "2-digit",
      month: "2-digit",
      timeZone: timezone,
      year: "numeric"
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
