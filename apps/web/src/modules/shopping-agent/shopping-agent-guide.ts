import { formatStorefrontMoney } from "../storefront/format";
import {
  classifyShoppingAgentMessage,
  readShoppingBudget,
  readShoppingQuery
} from "./shopping-agent-intent";
import { runShoppingAgentTool, type ShoppingAgentToolContext } from "./shopping-agent-tools";
import { SHOPPING_AGENT_ROW_DEFAULT, type ShoppingAgentTool } from "./shopping-agent.schema";

/**
 * Shopping help with no model at all.
 *
 * This is what a shop on a plan that grants `ai` but with no Gemini or OpenAI
 * key of its own gets, and it is deliberately not an error page. It is a
 * natural-language front end to the shop's own search index: the message is
 * classified, a budget is read out of it, the scaffolding words are stripped,
 * and the result is the same `search_products` call the model would have made —
 * so a shopper who types "কিছু সস্তা হেডফোন ৩০০০ টাকার নিচে" gets headphones
 * under three thousand taka either way.
 *
 * What it cannot do is hold a conversation, and it says so rather than pretending
 * otherwise. Every reply it produces is labelled `guided` in the widget, so a
 * template answer is never passed off as AI.
 */

export type ShoppingAgentGuidance = {
  answer: string;
  followUps: string[];
  productIds: string[];
  used: ShoppingAgentTool[];
};

export async function composeShoppingGuidance(
  context: ShoppingAgentToolContext,
  message: string
): Promise<ShoppingAgentGuidance> {
  const intent = classifyShoppingAgentMessage(message);

  if (intent === "cart" || intent === "checkout") {
    return guideToCart(context, intent);
  }

  if (intent === "categories") {
    return guideToCategories(context);
  }

  return guideToProducts(context, message, intent);
}

/**
 * The shopper's own basket, and the one link that finishes the job.
 *
 * `checkout` lands here too rather than in a search: somebody asking about
 * delivery charges or how to pay wants the checkout page, where the shop's real
 * shipping rates and payment methods are, not a product list.
 */
async function guideToCart(
  context: ShoppingAgentToolContext,
  intent: "cart" | "checkout"
): Promise<ShoppingAgentGuidance> {
  const observation = await runShoppingAgentTool(context, "view_cart", {});
  const cart = observation.result as { itemCount: number; subtotal: string } | undefined;

  if (!cart || cart.itemCount === 0) {
    return {
      answer:
        "Your cart is empty at the moment. Tell me what you are looking for and I will find it in the shop.",
      followUps: ["What do you sell?", "Show me your best sellers"],
      productIds: [],
      used: ["view_cart"]
    };
  }

  const money = formatStorefrontMoney(cart.subtotal, context.store.currency);
  const items = `${cart.itemCount} ${cart.itemCount === 1 ? "item" : "items"}`;

  return {
    answer:
      intent === "checkout"
        ? `You have ${items} in your cart, ${money} before delivery. Open checkout to pick a delivery area and a payment method — the exact total is worked out there.`
        : `You have ${items} in your cart, ${money} before delivery. Open the cart to change quantities, or go straight to checkout.`,
    followUps: ["Show me something else", "What do you sell?"],
    productIds: [],
    used: ["view_cart"]
  };
}

async function guideToCategories(
  context: ShoppingAgentToolContext
): Promise<ShoppingAgentGuidance> {
  const observation = await runShoppingAgentTool(context, "list_categories", {});
  const data = observation.result as { categories: Array<{ name: string }> } | undefined;
  const names = (data?.categories ?? []).slice(0, 8).map((category) => category.name);

  if (names.length === 0) {
    return {
      answer: "Tell me what you are looking for and I will search the shop for it.",
      followUps: ["Show me your best sellers"],
      productIds: [],
      used: ["list_categories"]
    };
  }

  return {
    answer: `This shop sells ${joinWords(names)}. Tell me which one you want and roughly what you would like to spend.`,
    followUps: names.slice(0, 3).map((name) => `Show me ${name}`),
    productIds: [],
    used: ["list_categories"]
  };
}

/**
 * The search itself.
 *
 * Two passes, and the second one matters more than it looks: a shopper who asks
 * for something the shop does not stock ("do you have a fridge") gets an empty
 * first pass, and the honest answer is "no, but here is what we do sell" rather
 * than silence. So the fallback re-runs with no query at all and says plainly
 * that it could not find what they asked for.
 */
async function guideToProducts(
  context: ShoppingAgentToolContext,
  message: string,
  intent: "browse" | "cheapest" | "compare"
): Promise<ShoppingAgentGuidance> {
  const budget = readShoppingBudget(message);
  const query = readShoppingQuery(message);
  const sort = intent === "cheapest" ? "price-asc" : "relevance";
  const observation = await runShoppingAgentTool(context, "search_products", {
    ...budget,
    limit: SHOPPING_AGENT_ROW_DEFAULT,
    ...(query ? { query } : {}),
    sort
  });
  const found = readSearchResult(observation.result);

  if (found.length > 0) {
    return {
      answer: describeFound(found, { budget, context, intent, query }),
      followUps: followUpsFor(found),
      productIds: found.map((product) => product.id),
      used: ["search_products"]
    };
  }

  // Nothing matched. Show what the shop does have rather than an apology on its
  // own — an empty answer is where a shopper leaves.
  const fallback = await runShoppingAgentTool(context, "search_products", {
    limit: SHOPPING_AGENT_ROW_DEFAULT,
    sort: "best-selling"
  });
  const popular = readSearchResult(fallback.result);
  const asked = query || "that";

  return {
    answer: popular.length
      ? `I could not find ${asked} in this shop. Here is what people are buying instead — tell me if any of it is close.`
      : `I could not find ${asked} in this shop just now. Try describing it another way, or browse the categories.`,
    followUps: ["What do you sell?", "Show me your cheapest items"],
    productIds: popular.map((product) => product.id),
    used: ["search_products"]
  };
}

type FoundProduct = {
  availability: string;
  id: string;
  price: string;
  title: string;
};

function readSearchResult(result: unknown): FoundProduct[] {
  const products = (result as { products?: FoundProduct[] } | undefined)?.products;

  return Array.isArray(products) ? products : [];
}

/**
 * The sentence above the cards.
 *
 * Deliberately says what was searched for rather than describing the products
 * again — the cards underneath carry the price, the stock and the picture, and
 * repeating them in prose is how a template answer starts sounding like filler.
 */
function describeFound(
  found: FoundProduct[],
  params: {
    budget: { maxPrice?: number; minPrice?: number };
    context: ShoppingAgentToolContext;
    intent: "browse" | "cheapest" | "compare";
    query: string;
  }
) {
  const { budget, context, intent, query } = params;
  const currency = context.store.currency;
  const count = found.length === 1 ? "one match" : `${found.length} matches`;
  const forWhat = query ? ` for ${query}` : "";
  const withinBudget =
    budget.maxPrice !== undefined
      ? ` under ${formatStorefrontMoney(budget.maxPrice, currency)}`
      : budget.minPrice !== undefined
        ? ` above ${formatStorefrontMoney(budget.minPrice, currency)}`
        : "";
  const cheapest = found[0];

  if (intent === "cheapest" && cheapest) {
    return `The lowest priced${forWhat} is ${cheapest.title} at ${formatStorefrontMoney(cheapest.price, currency)}. Here are ${count}, cheapest first.`;
  }

  if (intent === "compare" && found.length > 1) {
    return `Here are ${count}${forWhat}${withinBudget}. Open two of them to see the full details side by side, or tell me which ones you are choosing between.`;
  }

  const inStock = found.filter((product) => !product.availability.startsWith("Out of")).length;
  const stockNote =
    inStock === found.length
      ? " All of them are in stock."
      : inStock === 0
        ? " None of them are in stock right now."
        : ` ${inStock} of them are in stock.`;

  return `I found ${count}${forWhat}${withinBudget}.${stockNote}`;
}

function followUpsFor(found: FoundProduct[]) {
  const first = found[0];

  return [
    "Show me something cheaper",
    ...(first ? [`Add ${trimTitle(first.title)} to my cart`] : []),
    "What is in my cart?"
  ].slice(0, 3);
}

function trimTitle(title: string) {
  return title.length > 28 ? `${title.slice(0, 28).trimEnd()}…` : title;
}

function joinWords(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  return `${values.slice(0, -1).join(", ")} and ${values[values.length - 1]}`;
}
