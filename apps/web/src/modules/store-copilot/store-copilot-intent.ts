/**
 * What a question is about, without a model.
 *
 * The deterministic briefing needs to route "which products are low on stock"
 * to the inventory read and "এই মাসে মোট বিক্রি কত?" to the revenue figures, and
 * it has to do it with no AI at all — that is the whole point of the fallback.
 *
 * Kept in its own module so it is a pure function with no imports: the briefing
 * that uses it pulls in the whole read layer and, through it, Prisma, which
 * makes it awkward to check. This file can be imported and driven on its own,
 * which is what `npm run verify:store-copilot` does.
 */

/** Every intent, in the order it is tested. First match wins. */
export const STORE_COPILOT_INTENTS = [
  "inventory",
  "customers",
  "products",
  "orders",
  "revenue",
  "overview"
] as const;

export type StoreCopilotIntent = (typeof STORE_COPILOT_INTENTS)[number];

/**
 * Bangla and English together, because the store is Bangladeshi and half the
 * suggested prompts on the page are Bangla.
 *
 * Matching is substring-based rather than on word boundaries: Bangla inflects by
 * suffix, so "স্টকে" and "স্টক" must both hit, and `\b` does not mean anything
 * useful against Bengali script anyway. A false positive costs a slightly wrong
 * section of the briefing, never a wrong number — every figure is read from the
 * store either way.
 */
export const STORE_COPILOT_INTENT_KEYWORDS: Record<
  Exclude<StoreCopilotIntent, "overview">,
  readonly string[]
> = {
  customers: ["customer", "buyer", "client", "গ্রাহক", "কাস্টমার", "ক্রেতা"],
  inventory: [
    "stock",
    "inventory",
    "restock",
    "reorder",
    "out of stock",
    "low stock",
    "running out",
    "স্টক",
    "মজুদ",
    "শেষ"
  ],
  orders: ["order", "pending", "delivery", "shipment", "অর্ডার", "ডেলিভারি", "পেন্ডিং"],
  products: [
    "product",
    "best seller",
    "bestseller",
    "best-selling",
    "top selling",
    "catalogue",
    "catalog",
    "পণ্য",
    "প্রোডাক্ট",
    "সেরা",
    "বিক্রিত"
  ],
  revenue: [
    "revenue",
    "sales",
    // "sell" as well as "sold": "how much did we sell this month" is one of the
    // follow-ups the briefing itself offers, and it has to route home. Safe this
    // far down the list — "best selling" already matched `products` two tests
    // ago, so a bestseller question never reaches here.
    "sell",
    "sold",
    "income",
    "earning",
    "turnover",
    "বিক্রি",
    "আয়",
    "রেভিনিউ"
  ]
};

/**
 * Inventory is tested first and revenue last, and the order is the design.
 *
 * "Which products are low on stock" mentions products, and "how were sales this
 * month" mentions nothing else — so the more specific asks are tried before the
 * ones whose keywords appear inside them. `overview` is the answer when nothing
 * matched, which is also the right answer to "how are we doing?".
 */
export function classifyStoreCopilotQuestion(question: string): StoreCopilotIntent {
  const text = question.toLowerCase();

  for (const intent of STORE_COPILOT_INTENTS) {
    if (intent === "overview") {
      continue;
    }

    if (STORE_COPILOT_INTENT_KEYWORDS[intent].some((keyword) => text.includes(keyword))) {
      return intent;
    }
  }

  return "overview";
}
