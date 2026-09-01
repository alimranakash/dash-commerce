import { z } from "zod";
import {
  aiCouponCreateBodySchema,
  aiInventoryFilterSchema,
  aiOrderStatusSchema,
  aiOrderStatusUpdateSchema,
  aiProductStatusSchema,
  aiProductUpdateBodySchema,
  aiReportKeySchema,
  aiReportRangeSchema
} from "../ai/ai.schema";

/**
 * The AI Store Copilot's contract.
 *
 * Everything the assistant may *read* is a tool in the table below, and
 * everything it may *change* is a member of `storeCopilotActionSchema`. There is
 * no third path: the service dispatches on these enums, so a capability the
 * model invents resolves to nothing rather than to a query.
 *
 * Both halves are built out of `ai/ai.schema.ts` rather than beside it. The
 * external AI API already decided which columns an assistant may see, which
 * discount types exist and which order statuses a machine may set; re-declaring
 * any of that here would create a second answer that could drift from the first.
 * Reusing the same schemas also means a proposal that parses here is one
 * `createAiCoupon`, `updateAiProduct` and `setAiOrderStatus` can already execute.
 */

/* -------------------------------------------------------------------------- */
/*                                    Tools                                    */
/* -------------------------------------------------------------------------- */

export const STORE_COPILOT_TOOLS = [
  "list_customers",
  "list_inventory",
  "list_orders",
  "list_products",
  "sales_report",
  "store_overview"
] as const;

export type StoreCopilotTool = (typeof STORE_COPILOT_TOOLS)[number];

export const storeCopilotToolSchema = z.enum(STORE_COPILOT_TOOLS);

/**
 * The ceiling on rows one tool may put in front of the model.
 *
 * Far below the API's own `AI_PAGE_LIMIT_MAX` of 100 on purpose: this page is
 * answered inside a chat turn, and a hundred orders is both a slow request and a
 * context window spent on rows nobody asked about. A merchant who wants the
 * whole list has the orders page for that.
 */
export const STORE_COPILOT_ROW_LIMIT = 20;
export const STORE_COPILOT_ROW_DEFAULT = 10;

const rowLimitSchema = z.coerce
  .number()
  .int()
  .min(1)
  .max(STORE_COPILOT_ROW_LIMIT)
  .default(STORE_COPILOT_ROW_DEFAULT);

const searchSchema = z.string().trim().min(1).max(120).optional();

/**
 * One args schema per tool, and every field optional or defaulted.
 *
 * A model that names a tool but garbles its arguments should still get the
 * obvious answer — "show me low stock" without a filter is still low stock — so
 * the defaults below are the reading a merchant would expect rather than the
 * widest one.
 */
export const storeCopilotToolArgSchemas = {
  list_customers: z.object({
    limit: rowLimitSchema,
    search: searchSchema
  }),
  list_inventory: z.object({
    filter: aiInventoryFilterSchema.default("low"),
    limit: rowLimitSchema
  }),
  list_orders: z.object({
    limit: rowLimitSchema,
    status: aiOrderStatusSchema.optional()
  }),
  list_products: z.object({
    limit: rowLimitSchema,
    search: searchSchema,
    status: aiProductStatusSchema.optional()
  }),
  sales_report: z.object({
    key: aiReportKeySchema.default("overview"),
    range: aiReportRangeSchema.default("30d")
  }),
  store_overview: z.object({})
} as const;

export type StoreCopilotToolArgs = {
  [Tool in StoreCopilotTool]: z.infer<(typeof storeCopilotToolArgSchemas)[Tool]>;
};

/** What the model is told each tool answers. Rendered into the system prompt. */
export const STORE_COPILOT_TOOL_DESCRIPTIONS: Record<StoreCopilotTool, string> = {
  list_customers:
    "Customers with order counts and lifetime spend, newest first. Contact details are masked. Args: limit (1-20), search.",
  list_inventory:
    'Stock levels with a computed state, lowest stock first. Args: filter ("all" | "low" | "out"), limit (1-20).',
  list_orders:
    "Recent orders with totals, status, items and city, newest first. Args: limit (1-20), status.",
  list_products:
    "Catalogue entries with price, stock and status. Args: limit (1-20), search, status.",
  sales_report:
    'One of the dashboard reports. Args: key ("overview" | "revenues" | "orders" | "products" | "customers" | "merchandising" | "abandoned-carts" | "incomplete-orders"), range ("30d" | "90d" | "12m").',
  store_overview:
    "Today's and this month's revenue, order and product counts, pending orders, recent orders, best sellers and low-stock products. Start here for most questions. No args."
};

/* -------------------------------------------------------------------------- */
/*                            What the model answers                           */
/* -------------------------------------------------------------------------- */

/**
 * The planning turn: which data to fetch, or which change to propose.
 *
 * `tools` and `action` are both optional because the three useful outcomes are
 * "read these first", "propose this change", and "I can answer this without
 * looking anything up". The model is told to pick one; a reply carrying both is
 * read as the tools it asked for, and the action is re-proposed on the next turn
 * once it has the data — which is the safer of the two orderings.
 */
export const storeCopilotPlanSchema = z.object({
  action: z.unknown().optional(),
  reply: z.string().trim().max(4000).optional(),
  tools: z
    .array(
      z.object({
        args: z.record(z.string(), z.unknown()).default({}),
        tool: storeCopilotToolSchema
      })
    )
    .max(4)
    .default([])
});

export type StoreCopilotPlan = z.infer<typeof storeCopilotPlanSchema>;

/** The answering turn, once the tool results are in front of the model. */
export const storeCopilotAnswerSchema = z.object({
  action: z.unknown().optional(),
  answer: z.string().trim().min(1).max(4000),
  followUps: z.array(z.string().trim().min(1).max(120)).max(4).default([])
});

/* -------------------------------------------------------------------------- */
/*                                   Actions                                   */
/* -------------------------------------------------------------------------- */

/**
 * The three changes a merchant may approve from the chat.
 *
 * Exactly the three the external AI API already exposes, and for the same
 * reason: each is a thin shell over the service the dashboard's own buttons
 * call, so slug and SKU uniqueness, the coupon invariants and the fake-order
 * re-scoring that hangs off a cancellation all still happen. Nothing here can
 * reach a write path the merchant does not already have on screen.
 *
 * Deletion is absent, and not by oversight. A coupon expires and a product can
 * be set back to DRAFT, but nothing an assistant does should be unrecoverable.
 */
export const storeCopilotActionSchema = z.discriminatedUnion("type", [
  z.object({
    body: aiCouponCreateBodySchema,
    type: z.literal("create_coupon")
  }),
  z.object({
    body: aiProductUpdateBodySchema,
    productId: z.string().trim().min(1),
    type: z.literal("update_product")
  }),
  z.object({
    orderId: z.string().trim().min(1),
    status: aiOrderStatusUpdateSchema,
    type: z.literal("update_order_status")
  })
]);

export type StoreCopilotAction = z.infer<typeof storeCopilotActionSchema>;
export type StoreCopilotActionType = StoreCopilotAction["type"];

/** How each action is introduced to the merchant above the Confirm button. */
export const STORE_COPILOT_ACTION_LABELS: Record<StoreCopilotActionType, string> = {
  create_coupon: "Create a discount code",
  update_order_status: "Change an order's status",
  update_product: "Update a product"
};

/* -------------------------------------------------------------------------- */
/*                              The chat itself                                */
/* -------------------------------------------------------------------------- */

export const storeCopilotMessageSchema = z.object({
  content: z.string().trim().min(1).max(4000),
  role: z.enum(["assistant", "user"])
});

export type StoreCopilotMessage = z.infer<typeof storeCopilotMessageSchema>;

/**
 * One question, with as much of the conversation as is worth carrying.
 *
 * The history arrives from the browser rather than a table: this assistant
 * answers from the store's live data every turn, so a transcript is context for
 * phrasing ("and last month?") and never a source of facts. Bounded at six turns
 * because a longer one costs the merchant's own API allowance for a question
 * that has usually moved on.
 */
export const storeCopilotAskSchema = z.object({
  history: z.array(storeCopilotMessageSchema).max(6).default([]),
  message: z
    .string()
    .trim()
    .min(1, "Ask a question about your store.")
    .max(1000, "That question is too long — try asking it in a sentence or two.")
});

export type StoreCopilotAskInput = z.input<typeof storeCopilotAskSchema>;

/**
 * Which engine wrote the answer, always shown.
 *
 * `offline` is not a failure state: it is the deterministic briefing built from
 * the store's own numbers, which is what a merchant with no provider key gets,
 * and it is labelled as not being AI at all rather than passed off as one.
 */
export type StoreCopilotSource = "gemini" | "offline" | "openai";

/**
 * The proposal as the merchant reads it, built on the server.
 *
 * The chat component is handed these rows rather than the action object so it
 * can render a confirmation card without importing the schemas — and so the
 * merchant is shown the field names the store uses ("Discount", "Expires")
 * rather than the wire names the API takes.
 */
export type StoreCopilotActionPreview = {
  label: string;
  rows: Array<{ label: string; value: string }>;
};

export type StoreCopilotReply = {
  /** A change awaiting the merchant's Confirm, or null. */
  action: StoreCopilotAction | null;
  /** How that change is shown above the Confirm button. Null when there is none. */
  actionPreview: StoreCopilotActionPreview | null;
  answer: string;
  followUps: string[];
  source: StoreCopilotSource;
  /** The tools the answer was built from, so the merchant can see its evidence. */
  used: StoreCopilotTool[];
  warnings: string[];
};

export type StoreCopilotActionResult =
  | {
      message: string;
      ok: true;
    }
  | {
      error: string;
      ok: false;
    };
