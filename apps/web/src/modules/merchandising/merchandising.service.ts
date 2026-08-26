import type { ProductStatus } from "../products/product.types";
import type { StorefrontProduct } from "../storefront/storefront.types";
import {
  getAddableStorefrontProductsByIds,
  getCandidateProductsByIds,
  getCoPurchasedProductIds,
  getExistingProductIds,
  getProductRelationsWithProducts,
  getPublicProductRelations,
  getPublicProductsByIds,
  getRelationCandidateProducts,
  replaceProductRelations,
  type CoPurchaseCount,
  type ProductRelationWriteRow
} from "./merchandising.repository";
import {
  CO_PURCHASE_WINDOW_DAYS,
  MIN_CO_PURCHASE_ORDERS,
  PRODUCT_RELATION_PRIORITY,
  setProductRelationsSchema,
  type ProductRelationType,
  type SetProductRelationsInput
} from "./merchandising.schema";

/** One product as the seller-side pickers show it. */
export type ProductRelationOption = {
  id: string;
  imageUrl: string | null;
  price: string;
  sku: string | null;
  status: ProductStatus;
  title: string;
};

export type ProductRelationSelections = Record<ProductRelationType, ProductRelationOption[]>;

export function emptyProductRelationSelections(): ProductRelationSelections {
  return {
    ACCESSORY: [],
    CROSS_SELL: [],
    UPSELL: []
  };
}

/** What the product editor loads: the current pairings, grouped by list. */
export async function getProductRelationSelections(
  storeId: string,
  productId: string
): Promise<ProductRelationSelections> {
  const rows = await getProductRelationsWithProducts(storeId, productId);
  const selections = emptyProductRelationSelections();

  for (const row of rows) {
    selections[row.type].push(toRelationOption(row.relatedProduct));
  }

  return selections;
}

export async function getProductRelationCandidates(
  storeId: string
): Promise<ProductRelationOption[]> {
  const products = await getRelationCandidateProducts(storeId);

  return products.map(toRelationOption);
}

/**
 * Replace every pairing leaving one product.
 *
 * Ids the store does not own and the product's own id are dropped rather than
 * rejected: the picker cannot offer either, so their only source is a tampered
 * form, and failing the whole product save over one is the worse answer.
 */
export async function setProductRelations(
  storeId: string,
  productId: string,
  input: SetProductRelationsInput
) {
  const parsed = setProductRelationsSchema.parse(input);
  const requestedIds = uniqueIds(
    PRODUCT_RELATION_PRIORITY.flatMap((type) => parsed[type])
  ).filter((id) => id !== productId);
  const allowedIds = await getExistingProductIds(storeId, requestedIds);
  const rows: ProductRelationWriteRow[] = [];

  for (const type of PRODUCT_RELATION_PRIORITY) {
    const ids = uniqueIds(parsed[type]).filter((id) => allowedIds.has(id));

    for (const [position, relatedProductId] of ids.entries()) {
      rows.push({ position, relatedProductId, type });
    }
  }

  await replaceProductRelations({ productId, rows, storeId });

  return rows.length;
}

/**
 * The products a seller has paired with this one, best first, for a storefront
 * rail.
 *
 * A product listed in two lists — an upsell that is also an accessory — is one
 * card, not two, and it takes the better of its two places.
 */
export async function getPairedStorefrontProducts(input: {
  productId: string;
  storeId: string;
  take: number;
}): Promise<StorefrontProduct[]> {
  if (input.take <= 0) {
    return [];
  }

  const rows = await getPublicProductRelations(input.storeId, input.productId);
  const ordered = rows.slice().sort((first, second) => {
    const byType = relationRank(first.type) - relationRank(second.type);

    return byType === 0 ? first.position - second.position : byType;
  });
  const seen = new Set<string>();
  const products: StorefrontProduct[] = [];

  for (const row of ordered) {
    if (seen.has(row.relatedProductId) || products.length >= input.take) {
      continue;
    }

    seen.add(row.relatedProductId);
    products.push(row.relatedProduct);
  }

  return products;
}

/** One co-purchased product, with the evidence behind it. */
export type ProductRelationSuggestion = {
  option: ProductRelationOption;
  orderCount: number;
};

/**
 * What the store's own orders say belongs beside this product, for the rail
 * that has run out of hand-picked pairings.
 *
 * This is the half of the rail that costs the seller nothing: a store with
 * orders gets a cross-sell row without ever opening the picker.
 */
export async function getCoPurchasedStorefrontProducts(input: {
  excludeProductIds: string[];
  productId: string;
  storeId: string;
  take: number;
}): Promise<StorefrontProduct[]> {
  if (input.take <= 0) {
    return [];
  }

  const ranked = await rankedCoPurchases({
    excludeProductIds: input.excludeProductIds,
    productId: input.productId,
    storeId: input.storeId,
    take: input.take
  });
  const products = await getPublicProductsByIds(
    input.storeId,
    ranked.map((count) => count.relatedProductId)
  );
  const byId = new Map(products.map((product) => [product.id, product]));

  return ranked
    .flatMap((count) => {
      const product = byId.get(count.relatedProductId);

      return product ? [product] : [];
    })
    .slice(0, input.take);
}

/**
 * The same counts, offered to the seller in the product editor.
 *
 * Pairs the seller has already made are dropped: suggesting a decision they
 * have taken is noise, and the picker beside this list already shows it.
 */
export async function getProductRelationSuggestions(
  storeId: string,
  productId: string,
  take = 6
): Promise<ProductRelationSuggestion[]> {
  const existing = await getProductRelationsWithProducts(storeId, productId);
  const ranked = await rankedCoPurchases({
    excludeProductIds: existing.map((row) => row.relatedProduct.id),
    productId,
    storeId,
    take
  });
  const products = await getCandidateProductsByIds(
    storeId,
    ranked.map((count) => count.relatedProductId)
  );
  const byId = new Map(products.map((product) => [product.id, product]));

  return ranked
    .flatMap((count) => {
      const product = byId.get(count.relatedProductId);

      return product ? [{ option: toRelationOption(product), orderCount: count.orderCount }] : [];
    })
    .slice(0, take);
}

/**
 * Co-purchase counts, minus what the caller already has.
 *
 * Over-fetches on purpose: the counts ignore visibility, so some of the ids
 * will not survive whichever filter the caller hydrates them through, and the
 * shortfall would otherwise show up as a short rail.
 */
async function rankedCoPurchases(input: {
  excludeProductIds: string[];
  productId: string;
  storeId: string;
  take: number;
}): Promise<CoPurchaseCount[]> {
  const counts = await getCoPurchasedProductIds({
    minOrders: MIN_CO_PURCHASE_ORDERS,
    productId: input.productId,
    since: coPurchaseWindowStart(),
    storeId: input.storeId,
    take: input.take * 4
  });
  const excluded = new Set([input.productId, ...input.excludeProductIds]);

  return counts.filter((count) => !excluded.has(count.relatedProductId));
}

function coPurchaseWindowStart() {
  return new Date(Date.now() - CO_PURCHASE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * How many of the cart's products get scanned for something to offer beside
 * them.
 *
 * Each one costs two queries and the checkout page waits on all of them, so
 * this is capped rather than run over the whole basket. The first few lines
 * are what the shopper thought about hardest anyway.
 */
const MAX_CART_PRODUCTS_SCANNED = 3;

/**
 * Ranked product ids worth offering beside a cart, best first.
 *
 * The seller's own pairings lead, then what this store's shoppers have bought
 * alongside these products. Upsells are left out: an upsell is the same
 * purchase at a higher price, so offering one as an addition asks the shopper
 * to buy both halves of a decision they have already made.
 */
export async function getCrossSellCandidateIds(input: {
  cartProductIds: string[];
  storeId: string;
  take: number;
}): Promise<string[]> {
  const cartIds = uniqueIds(input.cartProductIds).slice(0, MAX_CART_PRODUCTS_SCANNED);

  if (cartIds.length === 0 || input.take <= 0) {
    return [];
  }

  const inCart = new Set(uniqueIds(input.cartProductIds));
  const paired: Array<{ position: number; productId: string; rank: number }> = [];
  const coPurchased = new Map<string, number>();

  for (const productId of cartIds) {
    const relations = await getPublicProductRelations(input.storeId, productId);

    for (const row of relations) {
      if (row.type === "UPSELL" || inCart.has(row.relatedProductId)) {
        continue;
      }

      paired.push({
        position: row.position,
        productId: row.relatedProductId,
        rank: relationRank(row.type)
      });
    }

    const counts = await getCoPurchasedProductIds({
      minOrders: MIN_CO_PURCHASE_ORDERS,
      productId,
      since: coPurchaseWindowStart(),
      storeId: input.storeId,
      take: input.take * 2
    });

    for (const count of counts) {
      if (inCart.has(count.relatedProductId)) {
        continue;
      }

      // A product co-bought with two different cart lines is a better bet than
      // one co-bought with either alone, so the counts add up.
      coPurchased.set(
        count.relatedProductId,
        (coPurchased.get(count.relatedProductId) ?? 0) + count.orderCount
      );
    }
  }

  const rankedPairs = paired
    .slice()
    .sort((first, second) =>
      first.rank === second.rank ? first.position - second.position : first.rank - second.rank
    )
    .map((entry) => entry.productId);
  const rankedCounts = [...coPurchased.entries()]
    .sort((first, second) => second[1] - first[1])
    .map(([productId]) => productId);

  return uniqueIds([...rankedPairs, ...rankedCounts]).slice(0, input.take);
}

/**
 * Cross-sell candidates for a cart, as cards a rail can put an Add button on.
 *
 * `fallbackProductIds` is appended behind the ranked candidates rather than
 * mixed into them — it is whatever the caller has when the cart's own pairings
 * and co-purchase history come up short, and it must never outrank them.
 */
export async function getCartCrossSellProducts(input: {
  cartProductIds: string[];
  fallbackProductIds?: string[] | undefined;
  storeId: string;
  take: number;
}): Promise<StorefrontProduct[]> {
  if (input.take <= 0) {
    return [];
  }

  const candidateIds = await getCrossSellCandidateIds({
    cartProductIds: input.cartProductIds,
    storeId: input.storeId,
    // The hydration filter drops products with options and anything out of
    // stock, so ask for more ids than the rail has room for.
    take: input.take * 3
  });
  const inCart = new Set(input.cartProductIds);
  const rankedIds = uniqueIds([...candidateIds, ...(input.fallbackProductIds ?? [])]).filter(
    (productId) => !inCart.has(productId)
  );
  const products = await getAddableStorefrontProductsByIds(input.storeId, rankedIds);
  const byId = new Map(products.map((product) => [product.id, product]));

  return rankedIds
    .flatMap((productId) => {
      const product = byId.get(productId);

      return product ? [product] : [];
    })
    .slice(0, input.take);
}

function relationRank(type: ProductRelationType) {
  const rank = PRODUCT_RELATION_PRIORITY.indexOf(type);

  return rank === -1 ? PRODUCT_RELATION_PRIORITY.length : rank;
}

function toRelationOption(product: {
  id: string;
  images: Array<{ url: string }>;
  price: { toString: () => string };
  sku: string | null;
  status: ProductStatus;
  title: string;
}): ProductRelationOption {
  return {
    id: product.id,
    imageUrl: product.images[0]?.url ?? null,
    price: product.price.toString(),
    sku: product.sku,
    status: product.status,
    title: product.title
  };
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}
