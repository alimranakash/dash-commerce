import type { ProductCardProduct } from "../storefront/product-card-data";

/**
 * A saved product, as the wishlist page renders it.
 *
 * Deliberately the shared card payload plus one field. The wishlist grid is the
 * shop grid — same card, same badges, same money formatting — and the only thing
 * it knows that a shop listing does not is when the shopper saved the row.
 */
export type WishlistProduct = ProductCardProduct & {
  savedAt: string;
};

export type Wishlist = {
  count: number;
  items: WishlistProduct[];
  storeId: string;
};

/**
 * What every heart on a page is seeded from.
 *
 * Ids only: the buttons render on cards that already carry the product, so
 * shipping anything else would be sending the catalogue twice. Read once per
 * request by the storefront layout and published through `WishlistProvider`,
 * which is what keeps a grid of thirty cards at one database read rather than
 * thirty.
 */
export type WishlistState = {
  count: number;
  productIds: string[];
};

export const EMPTY_WISHLIST_STATE: WishlistState = {
  count: 0,
  productIds: []
};

/** One product's saved-count, for the seller's demand report. */
export type WishlistDemandRow = {
  productId: string;
  saves: number;
  slug: string;
  stockQuantity: number;
  title: string;
};
