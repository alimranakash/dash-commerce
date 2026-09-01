import { getAiMetrics, getAiReport } from "../ai/ai-analytics.service";
import { getAiCustomerPage } from "../ai/ai-customers.service";
import { getAiInventoryPage } from "../ai/ai-inventory.service";
import { getAiOrderPage } from "../ai/ai-orders.service";
import { getAiProductPage } from "../ai/ai-products.service";
import { getStoreIdentityById } from "../stores/store.repository";
import {
  storeCopilotToolArgSchemas,
  type StoreCopilotTool,
  type StoreCopilotToolArgs
} from "./store-copilot.schema";

/**
 * Where the assistant's facts come from.
 *
 * Every `run` below is a call into `modules/ai/*.service.ts` — the same read
 * layer the external AI API serves, which is itself a mapper over
 * `analytics.service.ts`, `order.service.ts`, `product.service.ts` and the rest.
 * So the chat, the AI API and the merchant's own dashboard all quote numbers
 * that came from one place. The moment this file computed a total of its own,
 * the assistant could contradict the home page and nobody could say which was
 * right.
 *
 * Two properties are inherited rather than re-implemented, and both matter:
 *
 * - **Tenancy.** Every function takes `storeId` as its first argument and scopes
 *   its query by it. This file never sees a store selector from a caller — the
 *   service passes the id `requireStore()` resolved from the session.
 * - **Redaction.** Customer phone numbers and email addresses arrive already
 *   masked, fraud scores and cost prices are absent, because the shared mappers
 *   drop them. A merchant can read all of it on their own pages; what this
 *   spares them is those columns being copied into a prompt and sent to Gemini
 *   or OpenAI on every question.
 */

type ToolRunner = {
  [Tool in StoreCopilotTool]: (
    storeId: string,
    args: StoreCopilotToolArgs[Tool]
  ) => Promise<unknown>;
};

/**
 * Declared with `satisfies` rather than annotated, so each runner keeps the
 * precise response type of the service behind it. The deterministic briefing
 * reads those types directly; an annotation would flatten them all to `unknown`
 * and force a cast at every use.
 */
export const storeCopilotToolRunners = {
  list_customers: async (storeId, args) => {
    const store = await getStoreIdentityById(storeId);

    return getAiCustomerPage(
      storeId,
      { limit: args.limit, ...(args.search ? { search: args.search } : {}) },
      store?.currency ?? "BDT"
    );
  },
  list_inventory: (storeId, args) =>
    getAiInventoryPage(storeId, { filter: args.filter, limit: args.limit }),
  list_orders: (storeId, args) =>
    getAiOrderPage(storeId, {
      limit: args.limit,
      ...(args.status ? { status: args.status } : {})
    }),
  list_products: (storeId, args) =>
    getAiProductPage(storeId, {
      limit: args.limit,
      ...(args.search ? { search: args.search } : {}),
      ...(args.status ? { status: args.status } : {})
    }),
  sales_report: (storeId, args) => getAiReport(storeId, args.key, args.range),
  store_overview: async (storeId) => {
    const [metrics, store] = await Promise.all([
      getAiMetrics(storeId),
      getStoreIdentityById(storeId)
    ]);

    return {
      ...metrics,
      store: store
        ? {
            businessType: store.businessType,
            country: store.country,
            currency: store.currency,
            name: store.name,
            timezone: store.timezone
          }
        : null
    };
  }
} satisfies ToolRunner;

export type StoreCopilotObservation = {
  args: Record<string, unknown>;
  /** The tool's own words when it failed, so the answer can say so honestly. */
  error?: string;
  result?: unknown;
  tool: StoreCopilotTool;
};

/**
 * Run one tool the model named.
 *
 * The arguments are parsed rather than trusted — a model that sends
 * `limit: "all"` or a status that does not exist gets the schema's default, not
 * a thrown request. A tool that throws is reported as an observation with an
 * `error` rather than failing the turn: "I could not read your orders" is a
 * better answer than a red box, and the model is shown the failure so it does
 * not invent numbers to cover it.
 */
export async function runStoreCopilotTool(
  storeId: string,
  tool: StoreCopilotTool,
  rawArgs: unknown
): Promise<StoreCopilotObservation> {
  const parsed = storeCopilotToolArgSchemas[tool].safeParse(rawArgs ?? {});
  const args = (parsed.success ? parsed.data : {}) as Record<string, unknown>;

  try {
    const runner = storeCopilotToolRunners[tool] as (
      storeId: string,
      args: unknown
    ) => Promise<unknown>;

    return { args, result: await runner(storeId, args), tool };
  } catch (error) {
    console.error(`[store-copilot] tool ${tool} failed:`, error);

    return { args, error: `${tool} could not be read.`, tool };
  }
}
