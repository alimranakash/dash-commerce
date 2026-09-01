import {
  compareProducts,
  listCatalogueCategories,
  readCartView,
  readProductDetails,
  readStoreInfo,
  searchCatalogue
} from "./shopping-agent-catalog";
import {
  shoppingAgentToolArgSchemas,
  type ShoppingAgentTool,
  type ShoppingAgentToolArgs
} from "./shopping-agent.schema";

/**
 * The six things the agent may look at, and the only six.
 *
 * Every runner is a call into `shopping-agent-catalog.ts`, which is itself a
 * mapper over the storefront's own read layer. So the chat, the category page
 * and the search results all quote one catalogue: the moment this file computed
 * a price or a stock level of its own, the agent could contradict the product
 * page a shopper is looking at while they read it.
 */

/**
 * What a tool needs beyond its arguments.
 *
 * `basePath` rather than an absolute origin, because the same store answers on
 * three addresses and only one of them wants the `/s/<slug>` prefix. Every URL
 * the agent produces is therefore relative and correct on all three, which is
 * also why nothing here reads `PLATFORM_ROOT_DOMAIN`.
 */
export type ShoppingAgentToolContext = {
  basePath: string;
  store: {
    currency: string;
    id: string;
    name: string;
  };
};

type ToolRunner = {
  [Tool in ShoppingAgentTool]: (
    context: ShoppingAgentToolContext,
    args: ShoppingAgentToolArgs[Tool]
  ) => Promise<unknown>;
};

/**
 * Declared with `satisfies` rather than annotated, so each runner keeps the
 * precise return type of the catalogue function behind it — the guided
 * fallback reads those types directly rather than casting `unknown`.
 */
export const shoppingAgentToolRunners = {
  compare_products: (context, args) =>
    compareProducts(context.store.id, args.productIds, context.basePath),
  list_categories: (context) => listCatalogueCategories(context.store.id),
  product_details: (context, args) =>
    readProductDetails(context.store.id, args.productId, context.basePath),
  search_products: (context, args) => searchCatalogue(context.store.id, args, context.basePath),
  store_info: (context) => readStoreInfo(context.store, context.basePath),
  view_cart: (context) => readCartView(context.store.id, context.basePath)
} satisfies ToolRunner;

export type ShoppingAgentObservation = {
  args: Record<string, unknown>;
  /** The tool's own words when it failed, so the answer can say so honestly. */
  error?: string;
  result?: unknown;
  tool: ShoppingAgentTool;
};

/**
 * Run one tool the model named.
 *
 * Arguments are parsed rather than trusted — a model that sends `limit: "lots"`
 * or a sort that does not exist gets the schema's default, not a thrown request.
 * A tool that throws becomes an observation carrying an `error` rather than
 * failing the turn: "I could not read the catalogue just then" is a better
 * answer to a shopper than a red box, and the model is shown the failure so it
 * does not invent products to cover it.
 */
export async function runShoppingAgentTool(
  context: ShoppingAgentToolContext,
  tool: ShoppingAgentTool,
  rawArgs: unknown
): Promise<ShoppingAgentObservation> {
  const parsed = shoppingAgentToolArgSchemas[tool].safeParse(rawArgs ?? {});

  // `product_details` and `compare_products` are the two whose arguments cannot
  // be defaulted — there is no sensible "some product". A model that names
  // neither is told so rather than being silently handed the wrong thing.
  if (!parsed.success) {
    return {
      args: {},
      error: `${tool} needs a product id from a search result.`,
      tool
    };
  }

  const args = parsed.data as Record<string, unknown>;

  try {
    const runner = shoppingAgentToolRunners[tool] as (
      context: ShoppingAgentToolContext,
      args: unknown
    ) => Promise<unknown>;

    return { args, result: await runner(context, args), tool };
  } catch (error) {
    console.error(`[shopping-agent] tool ${tool} failed:`, error);

    return { args, error: `${tool} could not be read.`, tool };
  }
}
