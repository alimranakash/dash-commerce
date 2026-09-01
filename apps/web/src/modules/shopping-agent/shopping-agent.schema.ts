import { z } from "zod";
import { checkoutSchema } from "../checkout/checkout.schema";

/**
 * The AI Shopping Agent's contract.
 *
 * The shopper-facing twin of `store-copilot.schema.ts`, and deliberately the
 * same shape: everything the agent may *read* is a tool in the table below,
 * everything it may *change* is a member of `shoppingAgentActionSchema`, and the
 * service dispatches on those two enums so a capability the model invents
 * resolves to nothing rather than to a query.
 *
 * What differs is who is on the other end. The copilot answers the merchant, who
 * may see every column of their own store; this answers a member of the public,
 * so the read tools are built on `storefront/resolver.ts` — the same functions
 * that render the shop's own pages — and can therefore only ever surface a
 * product that is already ACTIVE and PUBLIC. There is no redaction step here
 * because there is nothing to redact: the agent is reading the shop window.
 *
 * The order half is built by narrowing `checkoutSchema` rather than restating
 * it. That is what makes a proposal which parses here one `createCheckoutOrder`
 * can already execute — the same relationship the copilot's actions have with
 * the AI API's body schemas — so the coupon, stock, plan, blocklist and
 * verification rules a shopper meets on the checkout page are the ones they meet
 * in the chat, because it is literally the same function.
 */

/* -------------------------------------------------------------------------- */
/*                                    Tools                                   */
/* -------------------------------------------------------------------------- */

export const SHOPPING_AGENT_TOOLS = [
  "compare_products",
  "list_categories",
  "product_details",
  "search_products",
  "store_info",
  "view_cart"
] as const;

export type ShoppingAgentTool = (typeof SHOPPING_AGENT_TOOLS)[number];

export const shoppingAgentToolSchema = z.enum(SHOPPING_AGENT_TOOLS);

/**
 * How many products one tool may put in front of the model.
 *
 * Lower than the copilot's twenty. A shopper asked for a recommendation, not a
 * catalogue dump: past about eight the answer stops being a recommendation, and
 * the storefront's own filtered listing is the better page for them anyway.
 */
export const SHOPPING_AGENT_ROW_LIMIT = 8;
export const SHOPPING_AGENT_ROW_DEFAULT = 4;

/** Four is already a table nobody can read on a phone. */
export const SHOPPING_AGENT_COMPARE_LIMIT = 4;

const rowLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(SHOPPING_AGENT_ROW_LIMIT)
  .default(SHOPPING_AGENT_ROW_DEFAULT);

const productIdSchema = z.string().trim().min(1).max(60);

const moneySchema = z.coerce.number().min(0).max(99999999);

export const shoppingAgentSortSchema = z.enum([
  "best-selling",
  "newest",
  "price-asc",
  "price-desc",
  "relevance"
]);

/**
 * One args schema per tool, everything optional or defaulted.
 *
 * A model that garbles its arguments should still get the obvious answer — a
 * search with no sort is a relevance search — so the defaults below are the
 * reading a shopper would expect rather than the widest one.
 */
export const shoppingAgentToolArgSchemas = {
  compare_products: z.object({
    productIds: z.array(productIdSchema).min(2).max(SHOPPING_AGENT_COMPARE_LIMIT).default([])
  }),
  list_categories: z.object({}),
  product_details: z.object({
    productId: productIdSchema
  }),
  search_products: z.object({
    availability: z.enum(["in-stock", "out-of-stock"]).optional(),
    categorySlug: z.string().trim().min(1).max(140).optional(),
    limit: rowLimitSchema,
    maxPrice: moneySchema.optional(),
    minPrice: moneySchema.optional(),
    query: z.string().trim().min(1).max(160).optional(),
    sort: shoppingAgentSortSchema.default("relevance")
  }),
  store_info: z.object({}),
  view_cart: z.object({})
} as const;

export type ShoppingAgentToolArgs = {
  [Tool in ShoppingAgentTool]: z.infer<(typeof shoppingAgentToolArgSchemas)[Tool]>;
};

/** What the model is told each tool answers. Rendered into the system prompt. */
export const SHOPPING_AGENT_TOOL_DESCRIPTIONS: Record<ShoppingAgentTool, string> = {
  compare_products:
    "Two to four products side by side: price, saving, availability, category and options. Args: productIds (2-4 ids from a search).",
  list_categories: "Every category this shop sells, with how many products are in each. No args.",
  product_details:
    "One product in full: description, features, every image, stock, and each variant with its own price and stock. Args: productId.",
  search_products:
    'The shop catalogue. Args: query (free text - describe what the shopper wants), categorySlug, minPrice, maxPrice, availability ("in-stock" | "out-of-stock"), sort ("relevance" | "price-asc" | "price-desc" | "newest" | "best-selling"), limit (1-8).',
  store_info:
    "Shipping methods with their ids and prices, payment methods, the currency, and whether this shop verifies phone numbers at checkout. Read this before proposing an order. No args.",
  view_cart:
    "What this shopper currently has in their cart, with line ids and the subtotal. No args."
};

/* -------------------------------------------------------------------------- */
/*                           What the model answers                           */
/* -------------------------------------------------------------------------- */

/** The planning turn: which data to fetch, or which change to propose. */
export const shoppingAgentPlanSchema = z.object({
  action: z.unknown().optional(),
  reply: z.string().trim().max(2000).optional(),
  tools: z
    .array(
      z.object({
        args: z.record(z.string(), z.unknown()).default({}),
        tool: shoppingAgentToolSchema
      })
    )
    .max(3)
    .default([])
});

/**
 * The answering turn.
 *
 * `productIds` and `compareIds` are the whole reason this is not a plain text
 * chat: the model picks *which* products it is recommending, and the server
 * re-reads each one from the catalogue to build the card. A card therefore
 * always carries the shop's own live price, stock and image — never a figure the
 * model typed — and an id it invented produces no card at all.
 */
export const shoppingAgentAnswerSchema = z.object({
  action: z.unknown().optional(),
  answer: z.string().trim().min(1).max(2000),
  compareIds: z.array(productIdSchema).max(SHOPPING_AGENT_COMPARE_LIMIT).default([]),
  followUps: z.array(z.string().trim().min(1).max(90)).max(3).default([]),
  productIds: z.array(productIdSchema).max(SHOPPING_AGENT_ROW_LIMIT).default([])
});

/* -------------------------------------------------------------------------- */
/*                                   Actions                                  */
/* -------------------------------------------------------------------------- */

/**
 * Everything the checkout form posts, except the four fields a shopper cannot
 * type into a chat.
 *
 * Narrowed from `checkoutSchema` rather than rewritten, so the agent cannot
 * propose an order shaped differently from the one the checkout page posts.
 * The four that are dropped:
 *
 * - `submissionId` — identifies one page load, and the service mints its own so
 *   a double-tapped Confirm cannot become two orders;
 * - `orderBumpProductId` — the checkout page's own tick-box offer, which belongs
 *   to that page and is priced by it;
 * - `verificationCode` — an SMS code the agent has no way to collect, and the
 *   reason a store that verifies numbers is handed to the checkout page instead;
 * - `paymentNote` — free text the model would be writing on the shopper's behalf.
 */
export const shoppingAgentOrderBodySchema = checkoutSchema
  .omit({
    orderBumpProductId: true,
    paymentNote: true,
    submissionId: true,
    verificationCode: true
  })
  /**
   * The one field that has to be relaxed, and why.
   *
   * `checkoutSchema` reads `email` from a form, where an untouched input still
   * posts `""` — so the key is always present there and the schema never had to
   * tolerate its absence. A chat has no empty input to post: a shopper who never
   * mentions an email address simply produces a body without the key, and under
   * the form's schema that is a hard parse failure, which would mean no Confirm
   * button on almost every order the agent proposes.
   *
   * The accepted *values* are unchanged — a real address, or nothing — and the
   * output is still `string | undefined`, so what reaches `createCheckoutOrder`
   * is exactly what the form would have sent for a shopper who left it blank.
   */
  .extend({
    email: z
      .union([z.email("Use a valid email address."), z.literal(""), z.null()])
      .optional()
      .transform((value) => (value ? value : undefined))
  });

export type ShoppingAgentOrderBody = z.infer<typeof shoppingAgentOrderBodySchema>;

/**
 * The three things a shopper may approve from the chat.
 *
 * Each is a button they already have somewhere on the storefront — add to cart,
 * remove a line, place the order — so the agent can reach nothing a shopper
 * could not reach themselves. Nothing runs until Confirm is pressed.
 */
export const shoppingAgentActionSchema = z.discriminatedUnion("type", [
  z.object({
    productId: productIdSchema,
    quantity: z.coerce.number().int().min(1).max(20).default(1),
    type: z.literal("add_to_cart"),
    variantId: z.string().trim().min(1).max(60).nullish()
  }),
  z.object({
    lineId: z.string().trim().min(1).max(140),
    type: z.literal("remove_from_cart")
  }),
  z.object({
    body: shoppingAgentOrderBodySchema,
    type: z.literal("place_order")
  })
]);

export type ShoppingAgentAction = z.infer<typeof shoppingAgentActionSchema>;
export type ShoppingAgentActionType = ShoppingAgentAction["type"];

/** How each action is introduced above the Confirm button. */
export const SHOPPING_AGENT_ACTION_LABELS: Record<ShoppingAgentActionType, string> = {
  add_to_cart: "Add to your cart",
  place_order: "Place your order",
  remove_from_cart: "Remove from your cart"
};

/**
 * Which of the three the shopper is being asked to approve, and how loudly.
 *
 * Placing an order spends money and dispatches a parcel; adding to a cart does
 * neither. The widget styles the confirmation card from this, so the one
 * irreversible button never looks like the two reversible ones.
 */
export const SHOPPING_AGENT_ACTION_WEIGHTS: Record<ShoppingAgentActionType, "high" | "low"> = {
  add_to_cart: "low",
  place_order: "high",
  remove_from_cart: "low"
};

/* -------------------------------------------------------------------------- */
/*                              The chat itself                               */
/* -------------------------------------------------------------------------- */

export const shoppingAgentMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  role: z.enum(["assistant", "user"])
});

export type ShoppingAgentMessage = z.infer<typeof shoppingAgentMessageSchema>;

export const shoppingAgentAskSchema = z.object({
  history: z.array(shoppingAgentMessageSchema).max(8).default([]),
  message: z
    .string()
    .trim()
    .min(1, "Tell me what you are looking for.")
    .max(600, "That is a long message — try asking in a sentence or two.")
});

export type ShoppingAgentAskInput = z.input<typeof shoppingAgentAskSchema>;

/* -------------------------------------------------------------------------- */
/*                           What the widget renders                          */
/* -------------------------------------------------------------------------- */

/**
 * A product as the chat draws it.
 *
 * Built on the server from the catalogue row every time, never from the model's
 * output, so the price on the card is the price the cart will charge.
 */
export type ShoppingAgentProductCard = {
  available: boolean;
  /** "In stock", "Only 2 left", "Pre-order" — the storefront's own vocabulary. */
  availabilityLabel: string;
  categoryName: string | null;
  compareAtPrice: string | null;
  /** Storefront relative, so it resolves on a subdomain and a custom domain alike. */
  href: string;
  id: string;
  imageAlt: string;
  imageUrl: string | null;
  price: string;
  /** True when the shopper must choose an option before this can be added. */
  requiresVariantChoice: boolean;
  shortDescription: string | null;
  title: string;
};

export type ShoppingAgentComparison = {
  products: Array<{ id: string; title: string }>;
  /** One row per attribute, values positionally aligned with `products`. */
  rows: Array<{ label: string; values: string[] }>;
};

export type ShoppingAgentCartLine = {
  lineId: string;
  lineTotal: string;
  quantity: number;
  title: string;
};

export type ShoppingAgentCartView = {
  checkoutHref: string;
  itemCount: number;
  lines: ShoppingAgentCartLine[];
  subtotal: string;
};

/**
 * The order, once it exists.
 *
 * `paymentHref` is the payment link: the store's own order page, which already
 * carries the total, the method the shopper chose and — for bKash, Nagad or
 * Rocket — the seller's account number and instructions. Storefront relative for
 * the same reason every other link here is.
 */
export type ShoppingAgentOrderReceipt = {
  currency: string;
  orderNumber: string;
  paymentHref: string;
  paymentInstructions: string | null;
  paymentLabel: string;
  total: string;
};

export type ShoppingAgentActionPreview = {
  label: string;
  rows: Array<{ label: string; value: string }>;
  weight: "high" | "low";
};

/**
 * Which engine answered, always shown.
 *
 * `guided` is not a failure state: it is the deterministic shopping assistant
 * built from the shop's own search index, which is what a store with no provider
 * key gets, and it is labelled as not being AI rather than passed off as one.
 */
export type ShoppingAgentSource = "gemini" | "guided" | "openai";

export type ShoppingAgentReply = {
  /** A change awaiting the shopper's Confirm, or null. */
  action: ShoppingAgentAction | null;
  actionPreview: ShoppingAgentActionPreview | null;
  answer: string;
  comparison: ShoppingAgentComparison | null;
  followUps: string[];
  products: ShoppingAgentProductCard[];
  source: ShoppingAgentSource;
  warnings: string[];
};

export type ShoppingAgentActionResult =
  | {
      cart: ShoppingAgentCartView | null;
      message: string;
      ok: true;
      order: ShoppingAgentOrderReceipt | null;
    }
  | {
      error: string;
      /** Where to finish by hand when the chat cannot. Storefront relative. */
      handoffHref: string | null;
      ok: false;
    };
