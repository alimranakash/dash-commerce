import { getInventoryPageForStore } from "../products/product.repository";
import {
  aiInventoryListResponseSchema,
  type AiInventoryListResponse,
  type AiInventoryQuery
} from "./ai.schema";

/**
 * Stock, as the AI is allowed to read it.
 *
 * A separate endpoint from `/products` rather than a filter on it, because the
 * two answer different questions. The catalogue read is "what do I sell"; this
 * is "what do I need to reorder", and it is ordered by how urgent that is
 * — lowest stock first — so the first page is the answer rather than the first
 * page of the answer.
 *
 * `state` is derived here so every caller reads the same comparison. Doing it
 * in the model's context window instead would mean an assistant deciding what
 * "low" means, which is a threshold the seller already set per product.
 */
export async function getAiInventoryPage(
  storeId: string,
  query: AiInventoryQuery
): Promise<AiInventoryListResponse> {
  const rows = await getInventoryPageForStore({
    storeId,
    take: query.limit + 1,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    filter: query.filter
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return aiInventoryListResponseSchema.parse({
    data: page.map((product) => ({
      allowPreorder: product.allowPreorder,
      id: product.id,
      lowStockThreshold: product.lowStockThreshold,
      sku: product.sku,
      state: stockState(product.stockQuantity, product.lowStockThreshold),
      stockQuantity: product.stockQuantity,
      title: product.title
    })),
    page: {
      hasMore,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null
    },
    storeId
  });
}

/**
 * Out beats low, and a threshold of zero never reports "low".
 *
 * That second rule matters: zero is the default threshold, so most products
 * have one, and treating "stock <= 0" as low for them would mark every
 * sold-out product as *both* — a list where the two states overlap is a list a
 * seller cannot act on.
 */
function stockState(stockQuantity: number, lowStockThreshold: number) {
  if (stockQuantity <= 0) {
    return "out_of_stock" as const;
  }

  return lowStockThreshold > 0 && stockQuantity <= lowStockThreshold
    ? ("low" as const)
    : ("in_stock" as const);
}
