import { getProductPageForStore } from "../products/product.service";
import { optionalDecimalToString, decimalToString, toIsoString } from "./ai-redact";
import {
  aiProductListResponseSchema,
  type AiProductListResponse,
  type AiProductQuery
} from "./ai.schema";

/**
 * The catalogue, as the AI is allowed to read it.
 *
 * A mapper, not a data layer. The rows come from `product.service.ts`, which is
 * the same function the dashboard's own catalogue read goes through, so there is
 * no second place products are queried from and no second set of tenant rules to
 * keep in step.
 *
 * What this file adds is the redaction: an explicit field-by-field DTO, so a
 * column added to `Product` next month cannot reach an external caller by
 * being picked up in a spread. `costPrice` is the one that matters most — it is
 * the seller's margin, and it is not in the mapping below.
 */
export async function getAiProductPage(
  storeId: string,
  query: AiProductQuery
): Promise<AiProductListResponse> {
  // One more than asked for: whether a next page exists is a fact about the
  // database, and the alternative — a second `count` query — can disagree with
  // the page it describes.
  const rows = await getProductPageForStore({
    storeId,
    take: query.limit + 1,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.status ? { status: query.status } : {})
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return aiProductListResponseSchema.parse({
    data: page.map(toAiProduct),
    page: {
      hasMore,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null
    },
    storeId
  });
}

type ProductRow = Awaited<ReturnType<typeof getProductPageForStore>>[number];

function toAiProduct(product: ProductRow) {
  return {
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug
        }
      : null,
    compareAtPrice: optionalDecimalToString(product.compareAtPrice),
    createdAt: toIsoString(product.createdAt),
    id: product.id,
    images: product.images.map((image) => ({
      alt: image.alt,
      position: image.position,
      url: image.url
    })),
    price: decimalToString(product.price),
    sku: product.sku,
    slug: product.slug,
    status: product.status,
    stockQuantity: product.stockQuantity,
    title: product.title,
    updatedAt: toIsoString(product.updatedAt),
    visibility: product.visibility
  };
}
