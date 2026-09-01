import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import {
  AiProviderError,
  parseJsonObject,
  requestGeminiCompletion,
  requestOpenAiCompletion
} from "../ai-provider/ai-provider-client";
import { AI_PROVIDER_META } from "../ai-provider/ai-provider.schema";
import {
  isShoppingAgentEnabled,
  resolveAiProvider,
  type ResolvedAiProvider
} from "../ai-provider/ai-provider.service";
import { consumeAiApiToken } from "../ai/ai-rate-limit";
import { hasPlanFeature } from "../billing/subscription-limits";
import { addToCart, removeCartItem } from "../cart/cart.service";
import { completeCheckoutOrder } from "../checkout/checkout-completion";
import { CheckoutError } from "../checkout/checkout-failure";
import { isCheckoutPhoneOtpRequired } from "../checkout/checkout-verification.service";
import { createCheckoutOrder } from "../checkout/checkout.service";
import { getPaymentMethods } from "../payments/payment.service";
import { getProductVariantConfiguration } from "../products/product-variants.service";
import { getEnabledShippingRates } from "../shipping/shipping.service";
import { formatStorefrontMoney } from "../storefront/format";
import {
  compareProducts,
  findPublicProduct,
  findPublicProducts,
  readCartView,
  toProductCard
} from "./shopping-agent-catalog";
import { composeShoppingGuidance } from "./shopping-agent-guide";
import {
  buildShoppingAgentAnswerPrompt,
  buildShoppingAgentPlanPrompt,
  buildShoppingAgentSystemPrompt,
  readShoppingAgentAnswer,
  readShoppingAgentPlan
} from "./shopping-agent-prompt";
import {
  runShoppingAgentTool,
  type ShoppingAgentObservation,
  type ShoppingAgentToolContext
} from "./shopping-agent-tools";
import {
  SHOPPING_AGENT_ACTION_LABELS,
  SHOPPING_AGENT_ACTION_WEIGHTS,
  shoppingAgentAskSchema,
  type ShoppingAgentAction,
  type ShoppingAgentActionPreview,
  type ShoppingAgentActionResult,
  type ShoppingAgentAskInput,
  type ShoppingAgentMessage,
  type ShoppingAgentOrderBody,
  type ShoppingAgentProductCard,
  type ShoppingAgentReply,
  type ShoppingAgentSource
} from "./shopping-agent.schema";

/**
 * The AI Shopping Agent.
 *
 * One turn is: decide what to look up, look it up through the storefront's own
 * read layer, and answer from what came back. The model never touches the
 * database, never sees a private column, and never buys anything — it names
 * tools from a closed enum and, at most, *proposes* one change that the shopper
 * executes with a button.
 *
 * ## The whole shopping flow, on the shop's own machinery
 *
 * Search and recommend run through `storefront/resolver.ts`, so the agent can
 * only surface a product the shop already sells publicly. Add-to-cart runs
 * through `cart.service.ts`, so the line lands in the same signed cookie the
 * header counts and the cart page prices. Placing the order runs through
 * `createCheckoutOrder` — the identical function `app/api/checkout/route.ts`
 * calls — so stock decrements, coupon claims, bundle pricing, the blocklist, the
 * plan's order limit, fraud scoring, the abandoned-cart snapshot and the
 * one-submission-one-order guarantee all apply exactly as they do to the form.
 * The payment link handed back is the store's own order page, which is where the
 * bKash, Nagad or Rocket instructions already live.
 *
 * There is no second commerce path here. Every write in this file is a call into
 * a service the storefront already calls.
 *
 * ## Which engine answers
 *
 * 1. The shop's **own Gemini or OpenAI key**, set in StoreIM AI > Settings — the
 *    same credential the Store Copilot and the Product Content Studio use,
 *    resolved by the same `resolveAiProvider`, still the only function in the
 *    codebase that decrypts it.
 * 2. The **guided assistant**, which searches the same catalogue and recommends
 *    the same products without a model.
 *
 * No platform-side model, for the same reason as the copilot: this feature
 * spends the merchant's own credential or nothing at all.
 *
 * ## Who may switch it on
 *
 * Two gates, and both have to pass. The **entitlement** is the shared StoreIM AI
 * one — a plan that grants `ai`, or the shop's own provider key, which no plan
 * may stand in the way of because the merchant pays that bill. The **switch** is
 * the merchant's: this agent talks to their customers in their shop's name and
 * spends their API allowance on public traffic, so it is off until they turn it
 * on, and turning it off takes it off the storefront immediately.
 */

/** Two provider calls per turn at most, so the bucket is charged for both. */
const TURN_COST = 2;

/** Tool reads per turn. The plan schema already caps the model's ask at three. */
const MAX_TOOLS_PER_TURN = 3;

/**
 * The shop pays for this out of its own API allowance, and the callers are the
 * public. So the store's bucket is charged as well as the shopper's: one
 * enthusiastic visitor cannot spend the whole month's budget, and one shop's
 * traffic cannot crowd out another's on the same instance.
 */
const STORE_BUCKET_COST = 1;

export type ShoppingAgentCapability = {
  /** True when the merchant has switched the agent on for their storefront. */
  enabled: boolean;
  /** The provider label for the badge, or null when it runs guided. */
  providerLabel: string | null;
  /** False unless the plan grants `ai_shopping_agent`, whatever the switch says. */
  entitled: boolean;
};

/**
 * Whether this shop should render the widget at all.
 *
 * Read on the storefront layout, and re-resolved inside `askShoppingAgent`
 * rather than trusted from a prop — a shop that switched the agent off, or lost
 * its plan, must not keep answering through a browser tab that was already open.
 *
 * **The plan is the only thing that grants this.** A store's own Gemini or
 * OpenAI key decides *who writes the replies*, never *whether there is an
 * assistant to write them* — a key is not a way around the tier a feature is
 * sold at. `getStoreCopilotCapability` and `canGenerateProductContent` draw the
 * same line, so all three StoreIM AI surfaces answer the entitlement question
 * the one way: the plan, and nothing else.
 */
export async function getShoppingAgentCapability(
  storeId: string
): Promise<ShoppingAgentCapability> {
  const [provider, entitled, enabled] = await Promise.all([
    resolveAiProvider(storeId),
    hasPlanFeature(storeId, "ai_shopping_agent"),
    isShoppingAgentEnabled(storeId)
  ]);

  return {
    enabled,
    entitled,
    providerLabel: provider ? AI_PROVIDER_META[provider.provider].label : null
  };
}

export type ShoppingAgentStore = {
  currency: string;
  id: string;
  name: string;
  slug: string;
};

export async function askShoppingAgent(params: {
  basePath: string;
  clientIp: string | null;
  input: ShoppingAgentAskInput;
  store: ShoppingAgentStore;
}): Promise<ShoppingAgentReply> {
  const { basePath, clientIp, input, store } = params;
  const data = shoppingAgentAskSchema.parse(input);
  const context: ShoppingAgentToolContext = { basePath, store };
  const capability = await getShoppingAgentCapability(store.id);

  // Re-checked here rather than trusted from the page, so both gates hold for
  // anything that can reach the server action.
  if (!capability.enabled || !capability.entitled) {
    return emptyReply(
      "The shopping assistant is not available on this shop right now. You can still search the catalogue from the menu above.",
      "guided"
    );
  }

  const shopperThrottle = consumeAiApiToken(
    `shopping-agent:ip:${clientIp ?? "unknown"}`,
    TURN_COST
  );
  const storeThrottle = consumeAiApiToken(`shopping-agent:store:${store.id}`, STORE_BUCKET_COST);

  if (!shopperThrottle.allowed || !storeThrottle.allowed) {
    const retryAfter = Math.max(shopperThrottle.retryAfterSeconds, storeThrottle.retryAfterSeconds);

    return emptyReply(
      `That is a lot of questions at once. Try again in about ${retryAfter} ${retryAfter === 1 ? "second" : "seconds"}.`,
      "guided"
    );
  }

  const provider = await resolveAiProvider(store.id);

  if (!provider) {
    return guidedReply(context, data.message, [
      "This shop's assistant is answering from its catalogue rather than in its own words."
    ]);
  }

  try {
    return await answerWithProvider({
      context,
      history: data.history,
      provider,
      question: data.message
    });
  } catch (error) {
    // The provider's own sentence names the key, the model or the quota — none
    // of which means anything to a shopper — so unlike the merchant-facing
    // copilot, what they are told is that the assistant is running on the
    // catalogue. The detail belongs in the server log, and it is written as one
    // readable line rather than a stack trace because the question it has to
    // answer is "why did my assistant stop writing?", and the answer is always
    // in that sentence: a rejected key, an unknown model, a rate limit, a
    // provider outage, a request that ran past the timeout, or a host that could
    // not be reached at all.
    console.error(
      `[shopping-agent] ${AI_PROVIDER_META[provider.provider].label} did not answer, so the shopper got the catalogue instead — ${describeProviderFailure(error)}`
    );

    return guidedReply(context, data.message, [
      error instanceof AiProviderError && error.retryable
        ? "The assistant is busy, so this answer came straight from the shop's catalogue."
        : "This answer came straight from the shop's catalogue."
    ]);
  }
}

/**
 * Which of the two provider calls failed, kept on the error for the log.
 *
 * The distinction is the first thing worth knowing when one starts failing: the
 * planning call sends a couple of sentences, while the answering call sends the
 * catalogue rows that came back, so a failure on the second and not the first
 * points at the size of the payload or the time it took, and a failure on both
 * points at the key or the network.
 *
 * Log-only. The shopper's wording is decided by `retryable`, not by this string,
 * and the other two AI surfaces share `AiProviderError` untouched.
 */
async function inPhase<T>(phase: "answer" | "plan", run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof AiProviderError) {
      throw new AiProviderError(`on the ${phase} call: ${error.message}`, error.retryable);
    }

    throw error;
  }
}

function describeProviderFailure(error: unknown) {
  if (error instanceof AiProviderError) {
    return error.retryable ? `${error.message} (worth retrying)` : error.message;
  }

  return error instanceof Error ? error.message : String(error);
}

async function answerWithProvider(params: {
  context: ShoppingAgentToolContext;
  history: ShoppingAgentMessage[];
  provider: ResolvedAiProvider;
  question: string;
}): Promise<ShoppingAgentReply> {
  const { context, history, provider, question } = params;
  const system = buildShoppingAgentSystemPrompt({
    currency: context.store.currency,
    storeName: context.store.name
  });
  const call = provider.provider === "gemini" ? requestGeminiCompletion : requestOpenAiCompletion;
  const source: ShoppingAgentSource = provider.provider;
  // Every turn, in both prompts. A shopper mid-purchase asks "and how much is
  // delivery on that" about the cart, not about the last thing searched for, and
  // a model that cannot see the basket answers a different question.
  const cartSummary = await describeCartForPrompt(context);

  const planText = await inPhase("plan", () =>
    call({
      apiKey: provider.apiKey,
      model: provider.model,
      system,
      user: buildShoppingAgentPlanPrompt({ cartSummary, history, question })
    })
  );
  const planJson = parseJsonObject(planText);

  if (!planJson) {
    return guidedReply(context, question, ["This answer came straight from the shop's catalogue."]);
  }

  const plan = readShoppingAgentPlan(planJson);

  // A proposal made before anything was read is still a proposal — the shopper
  // confirms it, and `finalise` has already re-read the product from this shop's
  // own catalogue before the button exists.
  if (plan.action && plan.tools.length === 0) {
    return finalise({
      action: plan.action,
      answer: plan.reply ?? "Here is what I can do — check it and confirm if it looks right.",
      compareIds: [],
      context,
      followUps: [],
      productIds: [],
      source,
      warnings: []
    });
  }

  if (plan.tools.length === 0 && plan.reply) {
    return finalise({
      action: null,
      answer: plan.reply,
      compareIds: [],
      context,
      followUps: [],
      productIds: [],
      source,
      warnings: []
    });
  }

  const calls = plan.tools.slice(0, MAX_TOOLS_PER_TURN);
  const observations: ShoppingAgentObservation[] = calls.length
    ? await Promise.all(calls.map((entry) => runShoppingAgentTool(context, entry.tool, entry.args)))
    : [await runShoppingAgentTool(context, "search_products", {})];

  const answerText = await inPhase("answer", () =>
    call({
      apiKey: provider.apiKey,
      model: provider.model,
      system,
      user: buildShoppingAgentAnswerPrompt({ cartSummary, history, observations, question })
    })
  );
  const answerJson = parseJsonObject(answerText);
  const answer = answerJson ? readShoppingAgentAnswer(answerJson) : null;

  if (!answer) {
    return guidedReply(context, question, ["This answer came straight from the shop's catalogue."]);
  }

  return finalise({
    action: answer.action,
    answer: answer.answer,
    compareIds: answer.compareIds,
    context,
    followUps: answer.followUps,
    productIds: answer.productIds,
    source,
    warnings: observations
      .filter((observation) => observation.error)
      .map(() => "Part of the catalogue could not be read just then, so it is not in this answer.")
  });
}

async function guidedReply(
  context: ShoppingAgentToolContext,
  message: string,
  warnings: string[]
): Promise<ShoppingAgentReply> {
  const guidance = await composeShoppingGuidance(context, message);

  return finalise({
    action: null,
    answer: guidance.answer,
    compareIds: [],
    context,
    followUps: guidance.followUps,
    productIds: guidance.productIds,
    source: "guided",
    warnings
  });
}

function emptyReply(answer: string, source: ShoppingAgentSource): ShoppingAgentReply {
  return {
    action: null,
    actionPreview: null,
    answer,
    comparison: null,
    followUps: [],
    products: [],
    source,
    warnings: []
  };
}

/**
 * Turn ids into cards, and a proposal into a confirmation — or drop both.
 *
 * This is the step that keeps a language model from selling a product that does
 * not exist. Whatever ids the model named are re-read from this store's public
 * catalogue here, so a card is always the shop's own live price, stock and
 * image; an id it invented, or one belonging to another shop, produces nothing
 * at all rather than a card the shopper cannot buy.
 */
async function finalise(params: {
  action: ShoppingAgentAction | null;
  answer: string;
  compareIds: string[];
  context: ShoppingAgentToolContext;
  followUps: string[];
  productIds: string[];
  source: ShoppingAgentSource;
  warnings: string[];
}): Promise<ShoppingAgentReply> {
  const { action, answer, compareIds, context, followUps, productIds, source, warnings } = params;
  const [products, comparison, preview] = await Promise.all([
    buildProductCards(context, productIds),
    compareIds.length >= 2
      ? compareProducts(context.store.id, compareIds, context.basePath)
      : Promise.resolve(null),
    action ? describeShoppingAgentAction(context, action) : Promise.resolve(null)
  ]);

  if (action && !preview) {
    return {
      action: null,
      actionPreview: null,
      answer,
      comparison,
      followUps,
      products,
      source,
      warnings: [
        ...warnings,
        "I could not offer that as a button — check the product page and add it from there."
      ]
    };
  }

  return {
    action,
    actionPreview: preview,
    answer,
    comparison,
    followUps,
    products,
    source,
    warnings
  };
}

async function buildProductCards(
  context: ShoppingAgentToolContext,
  productIds: string[]
): Promise<ShoppingAgentProductCard[]> {
  if (productIds.length === 0) {
    return [];
  }

  const products = await findPublicProducts(context.store.id, productIds);
  const configurations = await Promise.all(
    products.map((product) => getProductVariantConfiguration(context.store.id, product.id))
  );

  return products.map((product, index) =>
    toProductCard(product, {
      basePath: context.basePath,
      hasVariants: (configurations[index]?.variants.length ?? 0) > 0
    })
  );
}

/** One line about the basket, for both prompts. */
async function describeCartForPrompt(context: ShoppingAgentToolContext) {
  const cart = await readCartView(context.store.id, context.basePath);

  if (cart.itemCount === 0) {
    return "empty";
  }

  return `${cart.lines
    .map((line) => `${line.quantity}x ${line.title} (lineId ${line.lineId})`)
    .join(", ")} — subtotal ${cart.subtotal} ${context.store.currency} before delivery`;
}

/* -------------------------------------------------------------------------- */
/*                        Proposals, and running them                         */
/* -------------------------------------------------------------------------- */

/**
 * The proposal in the shopper's words, or null when it names something this
 * shop does not sell.
 *
 * Returning null is what keeps an invented id off the Confirm button: the
 * execution would have failed, and a shopper who pressed it would have been
 * shown a change that was never possible.
 */
export async function describeShoppingAgentAction(
  context: ShoppingAgentToolContext,
  action: ShoppingAgentAction
): Promise<ShoppingAgentActionPreview | null> {
  const label = SHOPPING_AGENT_ACTION_LABELS[action.type];
  const weight = SHOPPING_AGENT_ACTION_WEIGHTS[action.type];
  const currency = context.store.currency;

  if (action.type === "add_to_cart") {
    const product = await findPublicProduct(context.store.id, action.productId);

    if (!product) {
      return null;
    }

    const configuration = await getProductVariantConfiguration(context.store.id, product.id);
    const variant = action.variantId
      ? configuration.variants.find((entry) => entry.id === action.variantId)
      : null;

    // A product with options and no option chosen would add whichever variant
    // the cart service happens to pick, which is how a shopper ends up with the
    // wrong size. No button rather than the wrong one.
    if (configuration.variants.length > 0 && !variant) {
      return null;
    }

    const unitPrice = variant?.price ?? product.price.toString();

    return {
      label,
      rows: [
        { label: "Product", value: product.title },
        ...(variant ? [{ label: "Option", value: variant.title }] : []),
        { label: "Quantity", value: String(action.quantity) },
        { label: "Price", value: formatStorefrontMoney(unitPrice, currency) },
        {
          label: "Line total",
          value: formatStorefrontMoney(Number(unitPrice) * action.quantity, currency)
        }
      ],
      weight
    };
  }

  if (action.type === "remove_from_cart") {
    const cart = await readCartView(context.store.id, context.basePath);
    const line = cart.lines.find((entry) => entry.lineId === action.lineId);

    if (!line) {
      return null;
    }

    return {
      label,
      rows: [
        { label: "Item", value: line.title },
        { label: "Quantity", value: String(line.quantity) },
        { label: "Comes off", value: formatStorefrontMoney(line.lineTotal, currency) }
      ],
      weight
    };
  }

  const cart = await readCartView(context.store.id, context.basePath);

  // An order for an empty cart is not a proposal, it is a dead button.
  if (cart.itemCount === 0) {
    return null;
  }

  const { body } = action;
  const [rates, methods] = await Promise.all([
    getEnabledShippingRates(context.store.id),
    getPaymentMethods(context.store.id)
  ]);
  const rate = rates.find((entry) => entry.id === body.shippingRateId);
  const method = methods.find((entry) => entry.type === body.paymentMethod && entry.isEnabled);

  // Both are re-read from the store rather than taken from the proposal, so a
  // model that named a shipping rate from another shop — or one the seller has
  // since switched off — produces no button instead of a failing order.
  if (!rate || !method) {
    return null;
  }

  const subtotal = Number(cart.subtotal);
  const shipping = Number(rate.amount);

  return {
    label,
    rows: [
      { label: "Items", value: `${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}` },
      { label: "Subtotal", value: formatStorefrontMoney(subtotal, currency) },
      { label: "Delivery", value: `${rate.name} — ${formatStorefrontMoney(shipping, currency)}` },
      ...(body.couponCode ? [{ label: "Coupon", value: body.couponCode.toUpperCase() }] : []),
      {
        label: "Total",
        value: `${formatStorefrontMoney(subtotal + shipping, currency)}${body.couponCode ? " before your coupon" : ""}`
      },
      { label: "Deliver to", value: body.name },
      { label: "Phone", value: body.phone },
      { label: "Address", value: shortAddress(body) },
      { label: "Payment", value: method.name },
      ...(body.paymentReference ? [{ label: "Transaction id", value: body.paymentReference }] : [])
    ],
    weight
  };
}

function shortAddress(body: {
  addressLine1: string;
  area?: string | undefined;
  city?: string | undefined;
  district: string;
}) {
  return [body.addressLine1, body.area, body.city, body.district].filter(Boolean).join(", ");
}

/**
 * Run the change the shopper pressed Confirm on.
 *
 * Straight through `cart.service.ts` and `checkout.service.ts` — the same
 * functions `/api/cart` and `/api/checkout` call — so this path adds no write of
 * its own. Every stock check, coupon claim, plan limit and duplicate-submission
 * guard the storefront's own buttons trigger still happens, because it is the
 * same code doing it.
 *
 * The action is re-parsed by the caller and each target re-read here through
 * store-scoped functions, so a payload edited in the browser can still only do
 * what that shopper could do from the shop's own pages.
 */
export async function runShoppingAgentAction(params: {
  action: ShoppingAgentAction;
  basePath: string;
  clientIp: string | null;
  gaCookie: string | undefined;
  store: ShoppingAgentStore;
}): Promise<ShoppingAgentActionResult> {
  const { action, basePath, clientIp, gaCookie, store } = params;

  try {
    if (action.type === "add_to_cart") {
      const product = await findPublicProduct(store.id, action.productId);

      if (!product) {
        return failure("That product is not available in this shop any more.", null);
      }

      await addToCart(
        store.id,
        action.productId,
        action.quantity,
        action.variantId ?? null,
        "CART"
      );

      return {
        cart: await readCartView(store.id, basePath),
        message: `${product.title} is in your cart.`,
        ok: true,
        order: null
      };
    }

    if (action.type === "remove_from_cart") {
      await removeCartItem(store.id, action.lineId);

      return {
        cart: await readCartView(store.id, basePath),
        message: "Removed from your cart.",
        ok: true,
        order: null
      };
    }

    return await placeOrderFromChat({ basePath, body: action.body, clientIp, gaCookie, store });
  } catch (error) {
    // `CheckoutError` and the cart service's own throws are already sentences
    // written for a shopper — out of stock, an expired coupon, a cart that
    // emptied in another tab. Anything else is not described to the browser.
    if (error instanceof CheckoutError) {
      return failure(error.message, `${basePath}/checkout`);
    }

    if (error instanceof ZodError) {
      return failure(
        error.issues[0]?.message ?? "Some of those order details were not right.",
        `${basePath}/checkout`
      );
    }

    console.error("[shopping-agent] action failed:", error);

    return failure(
      error instanceof Error && error.message
        ? error.message
        : "That did not go through. Try it from the shop pages instead.",
      action.type === "place_order" ? `${basePath}/checkout` : null
    );
  }
}

/**
 * Search → recommend → cart → **order → payment link**, without leaving the chat.
 *
 * One thing is refused here rather than attempted: a shop that verifies phone
 * numbers on cash-on-delivery needs an SMS code, and there is no way to collect
 * one in a chat bubble. Those shoppers are handed the checkout page with their
 * cart intact, which is the page built to run that exchange. Everything else
 * goes through `createCheckoutOrder` unchanged.
 *
 * The submission id is minted here, once per confirmed press. That is what makes
 * a double-tapped Confirm — or a retried server action — return the order that
 * already exists instead of buying the basket twice, using the same unique index
 * the checkout form relies on.
 */
async function placeOrderFromChat(params: {
  basePath: string;
  body: ShoppingAgentOrderBody;
  clientIp: string | null;
  gaCookie: string | undefined;
  store: ShoppingAgentStore;
}): Promise<ShoppingAgentActionResult> {
  const { basePath, body, clientIp, gaCookie, store } = params;

  if (body.paymentMethod === "COD" && (await isCheckoutPhoneOtpRequired(store.id))) {
    return failure(
      "This shop confirms your phone number with a code before a cash-on-delivery order. Your cart is ready — open checkout to enter it and finish.",
      `${basePath}/checkout`
    );
  }

  const { order, replayed } = await createCheckoutOrder(
    store,
    {
      ...body,
      // Present even when the shopper never gave one: the checkout form always
      // posts this key, so its schema expects it, and a chat body that simply
      // lacks it would not be the same shape as a blank form field.
      email: body.email,
      // The three fields `shoppingAgentOrderBodySchema` drops, spelled out as
      // absent rather than left off. `checkoutSchema` treats them as present and
      // undefined, and stating them here is what makes the omission a decision a
      // reader can see instead of a gap in a spread.
      orderBumpProductId: undefined,
      paymentNote: undefined,
      submissionId: randomUUID(),
      verificationCode: undefined
    },
    { ipAddress: clientIp }
  );

  // A replay means the confirmation SMS has already gone and the purchase has
  // already been reported. Sending either again is exactly the damage the
  // submission key exists to prevent.
  if (!replayed) {
    await completeCheckoutOrder({ gaCookie, order, store });
  }

  const methods = await getPaymentMethods(store.id);
  const method = methods.find((entry) => entry.type === order.paymentMethodType);

  return {
    cart: await readCartView(store.id, basePath),
    message: `Order ${order.orderNumber} is placed.`,
    ok: true,
    order: {
      currency: order.currency,
      orderNumber: order.orderNumber,
      // The payment link: the shop's own order page, which already carries the
      // total, the method chosen and — for bKash, Nagad or Rocket — the seller's
      // account number and what to do with it. Relative, so it resolves on a
      // subdomain, a custom domain and the local path form alike.
      paymentHref: `${basePath}/thank-you/${order.orderNumber}`,
      paymentInstructions: method?.instructions ?? null,
      paymentLabel: order.paymentMethodName,
      total: order.totalAmount.toString()
    }
  };
}

function failure(error: string, handoffHref: string | null): ShoppingAgentActionResult {
  return { error, handoffHref, ok: false };
}
