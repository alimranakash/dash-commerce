/**
 * What a shopper wants, without a model.
 *
 * The guided assistant needs to route "show me something under 2000 taka" to a
 * price-capped search, "what's in my cart" to the cart, and "৩০০০ টাকার নিচে
 * শাড়ি" to both — with no AI at all, because that is what a shop on a plan but
 * without its own provider key actually gets.
 *
 * Kept in its own module so it is a pure function with no imports: the guide
 * that uses it pulls in the storefront read layer and, through it, Prisma, which
 * makes it awkward to check. This file can be imported and driven on its own,
 * which is what `npm run verify:shopping-agent` does.
 */

/** Every intent, in the order it is tested. First match wins. */
export const SHOPPING_AGENT_INTENTS = [
  "cart",
  "checkout",
  "categories",
  "compare",
  "cheapest",
  "browse"
] as const;

export type ShoppingAgentIntent = (typeof SHOPPING_AGENT_INTENTS)[number];

/**
 * Bangla and English together, because these are Bangladeshi storefronts and a
 * shopper is as likely to type "দাম কত" as "how much".
 *
 * Substring matching rather than word boundaries, for the same reason the
 * copilot's classifier uses it: Bangla inflects by suffix, so "কার্টে" and
 * "কার্ট" must both hit, and `\b` means nothing against Bengali script. A false
 * positive costs a slightly wrong opening sentence, never a wrong price — every
 * figure is read from the catalogue either way.
 */
export const SHOPPING_AGENT_INTENT_KEYWORDS: Record<
  Exclude<ShoppingAgentIntent, "browse">,
  readonly string[]
> = {
  cart: ["my cart", "in the cart", "basket", "কার্ট", "ব্যাগ", "ঝুড়ি"],
  categories: [
    "categor",
    "what do you sell",
    "what else",
    "browse",
    "collection",
    "ক্যাটাগরি",
    "কী কী",
    "কি কি"
  ],
  checkout: [
    "checkout",
    "place the order",
    "place my order",
    "buy now",
    "order now",
    "delivery charge",
    "shipping cost",
    "payment",
    "চেকআউট",
    "অর্ডার",
    "ডেলিভারি",
    "পেমেন্ট"
  ],
  cheapest: [
    "cheapest",
    "cheap",
    "budget",
    "affordable",
    "lowest price",
    "সস্তা",
    "কম দামে",
    "বাজেট"
  ],
  compare: [
    "compare",
    "difference between",
    "which is better",
    "vs ",
    " or ",
    "তুলনা",
    "পার্থক্য",
    "কোনটা ভালো"
  ]
};

export function classifyShoppingAgentMessage(message: string): ShoppingAgentIntent {
  const text = message.toLowerCase();

  for (const intent of SHOPPING_AGENT_INTENTS) {
    if (intent === "browse") {
      continue;
    }

    if (SHOPPING_AGENT_INTENT_KEYWORDS[intent].some((keyword) => text.includes(keyword))) {
      return intent;
    }
  }

  return "browse";
}

export type ShoppingAgentBudget = {
  maxPrice?: number;
  minPrice?: number;
};

/**
 * Bengali digits, so "৩০০০ টাকার নিচে" is a number and not a word.
 *
 * Done before any pattern runs rather than inside each one: a message can mix
 * scripts ("২০০০ to 5000 taka") and normalising once means every pattern below
 * only has to know about ASCII digits.
 */
const BENGALI_DIGITS = "০১২৩৪৫৬৭৮৯";

export function normaliseDigits(value: string) {
  return value.replace(/[০-৯]/g, (digit) => String(BENGALI_DIGITS.indexOf(digit)));
}

/**
 * What the shopper said they would spend.
 *
 * Ordered widest-first: a range ("2000-5000") has to be tested before a ceiling,
 * because "under 5000" is a substring of how people write the top of a range,
 * and a floor last because "over" is the rarest of the three in a shop.
 *
 * A number with no qualifier at all is read as a ceiling. That is the reading
 * that matches how people actually shop — somebody who types "shirt 1500" wants
 * a shirt for about 1500, not one at exactly 1500 — and the search still ranks
 * by relevance underneath it, so a slightly wrong cap costs an ordering rather
 * than an empty page.
 */
export function readShoppingBudget(message: string): ShoppingAgentBudget {
  const text = normaliseDigits(message.toLowerCase()).replace(/,/g, "");
  const range = /(\d{2,8})\s*(?:-|–|to|and|থেকে)\s*(\d{2,8})/.exec(text);

  if (range) {
    const first = Number(range[1]);
    const second = Number(range[2]);

    return { maxPrice: Math.max(first, second), minPrice: Math.min(first, second) };
  }

  const ceiling =
    /(?:under|below|less than|within|upto|up to|max|maximum|নিচে|মধ্যে|কমে)\s*[৳$]?\s*(\d{2,8})/.exec(
      text
    ) ??
    /[৳$]?\s*(\d{2,8})\s*(?:taka|tk|৳|টাকা)?\s*(?:er|র)?\s*(?:নিচে|মধ্যে|কমে|or less|or below)/.exec(
      text
    );

  if (ceiling?.[1]) {
    return { maxPrice: Number(ceiling[1]) };
  }

  const floor = /(?:over|above|more than|at least|উপরে|বেশি)\s*[৳$]?\s*(\d{2,8})/.exec(text);

  if (floor?.[1]) {
    return { minPrice: Number(floor[1]) };
  }

  const bare = /[৳$]?\s*(\d{3,8})\s*(?:taka|tk|৳|টাকা)/.exec(text);

  return bare?.[1] ? { maxPrice: Number(bare[1]) } : {};
}

/**
 * The message with the shopping scaffolding taken out, so what is left is what
 * they are actually looking for.
 *
 * "show me some cheap headphones under 3000 taka" has to reach the search index
 * as "headphones": full-text search requires every word by default, so leaving
 * "show", "me" and "cheap" in is what turns a good query into no results. The
 * stop list is small and deliberately only holds words that are never a product.
 */
const QUERY_STOP_WORDS = new Set([
  "a",
  "about",
  "am",
  "an",
  "and",
  "any",
  "anything",
  "are",
  "as",
  "at",
  "available",
  "best",
  "budget",
  "buy",
  "can",
  "cheap",
  "cheapest",
  "do",
  "does",
  "find",
  "for",
  "get",
  "give",
  "good",
  "have",
  "hello",
  "help",
  "hi",
  "i",
  "in",
  "is",
  "it",
  "less",
  "like",
  "looking",
  "me",
  "more",
  "my",
  "need",
  "of",
  "on",
  "or",
  "please",
  "price",
  "recommend",
  "see",
  "shop",
  "show",
  "some",
  "something",
  "suggest",
  "taka",
  "than",
  "that",
  "the",
  "there",
  "these",
  "this",
  "those",
  "tk",
  "to",
  "under",
  "up",
  "want",
  "what",
  "which",
  "with",
  "within",
  "would",
  "you",
  "your"
]);

export function readShoppingQuery(message: string) {
  const words = normaliseDigits(message)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !QUERY_STOP_WORDS.has(word) && !/^\d+$/.test(word));

  // Everything was scaffolding — "show me something cheap" — which is a real
  // request for the shop's own best sellers rather than a search for nothing.
  return words.slice(0, 8).join(" ").trim();
}
