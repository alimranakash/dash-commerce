import { getCrossSellCandidateIds } from "./merchandising.service";
import {
  getOrderBumpConfig,
  getOrderBumpProductOptions,
  getSellableOrderBumpProduct,
  getSellableOrderBumpProducts,
  saveOrderBumpConfig,
  type OrderBumpProduct
} from "./order-bump.repository";
import {
  orderBumpOfferPrice,
  saveOrderBumpSchema,
  type OrderBumpDiscountType,
  type OrderBumpOffer,
  type SaveOrderBumpInput
} from "./order-bump.schema";

/** The seller's configuration, as the dashboard form reads and writes it. */
export type OrderBumpSettings = {
  description: string;
  discountType: OrderBumpDiscountType;
  discountValue: string;
  enabled: boolean;
  headline: string;
  productId: string | null;
};

export const defaultOrderBumpSettings: OrderBumpSettings = {
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "0",
  enabled: false,
  headline: "Add this to your order",
  productId: null
};

/** How far down the candidate list to look before giving up on an offer. */
const AUTOMATIC_CANDIDATE_DEPTH = 8;

export async function getOrderBumpSettings(storeId: string): Promise<OrderBumpSettings> {
  const config = await getOrderBumpConfig(storeId);

  if (!config) {
    return defaultOrderBumpSettings;
  }

  return {
    description: config.description,
    discountType: config.discountType,
    discountValue: config.discountValue.toString(),
    enabled: config.enabled,
    headline: config.headline,
    productId: config.productId
  };
}

/**
 * Saves the configuration, having checked the pinned product can carry it.
 *
 * The check is here rather than at checkout time because this is where the
 * seller can still do something about it: a product that cannot be bumped is
 * worth one sentence now, not a silently empty checkout later.
 */
export async function saveOrderBump(
  storeId: string,
  input: SaveOrderBumpInput
): Promise<OrderBumpSettings> {
  const data = saveOrderBumpSchema.parse(input);

  if (data.productId && !(await getSellableOrderBumpProduct(storeId, data.productId))) {
    throw new Error(
      "Pick a product that is active, public, in this store, and has no options — the offer is a single tick with nowhere to ask which size."
    );
  }

  if (data.enabled && Number(data.discountValue) <= 0) {
    throw new Error("Set a discount above zero, or the offer has nothing to offer.");
  }

  const saved = await saveOrderBumpConfig(storeId, {
    description: data.description,
    discountType: data.discountType,
    discountValue: data.discountValue,
    enabled: data.enabled,
    headline: data.headline,
    productId: data.productId
  });

  return {
    description: saved.description,
    discountType: saved.discountType,
    discountValue: saved.discountValue.toString(),
    enabled: saved.enabled,
    headline: saved.headline,
    productId: saved.productId
  };
}

/**
 * The offer this cart should be shown, or nothing.
 *
 * Called twice per order — once to render the tick box, once when the order is
 * placed — and it reads the product's live price both times. That is the whole
 * safety story for this feature: the browser posts an id and never a price, so
 * the worst a tampered form can do is ask for an offer that is not standing,
 * which comes back as null.
 */
export async function resolveOrderBumpOffer(input: {
  cartProductIds: string[];
  storeId: string;
}): Promise<OrderBumpOffer | null> {
  const config = await getOrderBumpConfig(input.storeId);

  if (!config || !config.enabled) {
    return null;
  }

  const inCart = new Set(input.cartProductIds);
  const product = config.productId
    ? await pinnedOfferProduct(input.storeId, config.productId, inCart)
    : await automaticOfferProduct(input.storeId, input.cartProductIds, inCart);

  if (!product) {
    return null;
  }

  const pricing = orderBumpOfferPrice({
    discountType: config.discountType,
    discountValue: config.discountValue.toString(),
    listPrice: product.price.toString()
  });

  if (!pricing) {
    return null;
  }

  return {
    description: config.description || product.shortDescription || "",
    headline: config.headline,
    imageUrl: product.images[0]?.url ?? null,
    listPrice: product.price.toString(),
    offerPrice: pricing.offerPrice,
    productId: product.id,
    savingAmount: pricing.savingAmount,
    title: product.title
  };
}

/**
 * The offer, but only if it is the one the shopper actually ticked.
 *
 * A posted id that no longer resolves is not silently ignored by the caller:
 * the shopper asked for this item, and quietly dropping it would ship them an
 * order they did not agree to.
 */
export async function resolveOrderBumpForCheckout(input: {
  cartProductIds: string[];
  productId: string;
  storeId: string;
}): Promise<OrderBumpOffer | null> {
  const offer = await resolveOrderBumpOffer({
    cartProductIds: input.cartProductIds,
    storeId: input.storeId
  });

  return offer && offer.productId === input.productId ? offer : null;
}

async function pinnedOfferProduct(storeId: string, productId: string, inCart: Set<string>) {
  const product = await getSellableOrderBumpProduct(storeId, productId);

  return product && isOfferable(product, inCart) ? product : null;
}

async function automaticOfferProduct(
  storeId: string,
  cartProductIds: string[],
  inCart: Set<string>
) {
  const candidateIds = await getCrossSellCandidateIds({
    cartProductIds,
    storeId,
    take: AUTOMATIC_CANDIDATE_DEPTH
  });
  const products = await getSellableOrderBumpProducts(storeId, candidateIds);
  const byId = new Map(products.map((product) => [product.id, product]));

  // Walked in candidate order rather than filtered, so the best-ranked product
  // that survives the sellable check is the one offered.
  for (const candidateId of candidateIds) {
    const product = byId.get(candidateId);

    if (product && isOfferable(product, inCart)) {
      return product;
    }
  }

  return null;
}

/**
 * Pre-order products are deliberately never bumped.
 *
 * The tick box is an impulse: one look, one decision, no page to read. Putting
 * a "ships in March" item behind it would hold up the whole parcel over
 * something the shopper spent two seconds on.
 */
function isOfferable(product: OrderBumpProduct, inCart: Set<string>) {
  return !inCart.has(product.id) && product.stockQuantity > 0;
}

/** One product as the dashboard's pin selector lists it. */
export type OrderBumpProductOption = {
  id: string;
  price: string;
  title: string;
};

export async function getOrderBumpProducts(storeId: string): Promise<OrderBumpProductOption[]> {
  const products = await getOrderBumpProductOptions(storeId);

  return products.map((product) => ({
    id: product.id,
    price: product.price.toString(),
    title: product.title
  }));
}
