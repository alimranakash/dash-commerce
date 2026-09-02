import { toProductCardProduct } from "../storefront/product-card-data";
import { getStorefrontProductsByIds } from "../storefront/resolver";
import {
  countWishlistItems,
  deleteWishlist,
  deleteWishlistItem,
  findWishlistRows,
  insertWishlistItem
} from "./wishlist.repository";
import { forgetWishlistToken, readWishlistToken, requireWishlistToken } from "./wishlist-token";
import {
  EMPTY_WISHLIST_STATE,
  type Wishlist,
  type WishlistProduct,
  type WishlistState
} from "./wishlist.types";

/**
 * How many products one shopper may hold.
 *
 * A ceiling rather than a policy: a wishlist is keyed by an anonymous cookie, so
 * without one a single visitor can write unbounded rows into a seller's table.
 * Generous enough that no real shopper meets it.
 */
const WISHLIST_MAX_ITEMS = 200;

/**
 * What every heart on the page is seeded from, read once per request.
 *
 * Read-only by construction: it takes the token that already exists and never
 * mints one, so a shopper who has saved nothing is not given a cookie for
 * browsing, and this stays safe to call from a page render where Next forbids
 * setting one.
 */
export async function getWishlistState(storeId: string): Promise<WishlistState> {
  const token = await readWishlistToken(storeId);

  if (!token) {
    return EMPTY_WISHLIST_STATE;
  }

  const rows = await findWishlistRows(storeId, token);

  return {
    count: rows.length,
    productIds: rows.map((row) => row.productId)
  };
}

/**
 * The wishlist page's products.
 *
 * The saved ids are re-read through `getStorefrontProductsByIds`, which narrows
 * by `publicProductWhere` — so a product the seller has since taken to DRAFT or
 * HIDDEN drops out of the list rather than being shown at a price it is no
 * longer sold at. Rows whose product no longer resolves are simply absent; they
 * are left in the table rather than deleted, because a product hidden for a week
 * should come back to the list it was saved on.
 */
export async function getWishlist(storeId: string): Promise<Wishlist> {
  const token = await readWishlistToken(storeId);

  if (!token) {
    return { count: 0, items: [], storeId };
  }

  const rows = await findWishlistRows(storeId, token);
  const savedAtByProduct = new Map(rows.map((row) => [row.productId, row.createdAt]));
  const products = await getStorefrontProductsByIds(
    storeId,
    rows.map((row) => row.productId)
  );
  const items: WishlistProduct[] = products.map((product) => ({
    ...toProductCardProduct(product),
    savedAt: (savedAtByProduct.get(product.id) ?? product.createdAt).toISOString()
  }));

  return {
    count: items.length,
    items,
    storeId
  };
}

/**
 * Saves a product, mints the shopper's token if this is their first one.
 *
 * The product is checked against the storefront's own read layer rather than
 * being trusted from the request: an id for a DRAFT, HIDDEN or another store's
 * product does not come back, so it can no more be saved than linked.
 */
export async function addToWishlist(storeId: string, productId: string): Promise<WishlistState> {
  await requirePublicProduct(storeId, productId);

  const token = await requireWishlistToken(storeId);
  const count = await countWishlistItems(storeId, token);

  if (count >= WISHLIST_MAX_ITEMS) {
    throw new Error(`A wishlist holds up to ${WISHLIST_MAX_ITEMS} products.`);
  }

  await insertWishlistItem(storeId, token, productId);

  return getWishlistStateForToken(storeId, token);
}

export async function removeFromWishlist(
  storeId: string,
  productId: string
): Promise<WishlistState> {
  const token = await readWishlistToken(storeId);

  if (!token) {
    return EMPTY_WISHLIST_STATE;
  }

  await deleteWishlistItem(storeId, token, productId);

  return getWishlistStateForToken(storeId, token);
}

/**
 * One heart, pressed.
 *
 * The remove is attempted first and its row count decides: a shopper pressing
 * the same heart in two tabs gets one save and one removal rather than two saves,
 * because the answer comes from what the database did and not from what a read a
 * moment earlier said.
 */
export async function toggleWishlistItem(
  storeId: string,
  productId: string
): Promise<WishlistState> {
  const existingToken = await readWishlistToken(storeId);

  if (existingToken && (await deleteWishlistItem(storeId, existingToken, productId))) {
    return getWishlistStateForToken(storeId, existingToken);
  }

  return addToWishlist(storeId, productId);
}

export async function clearWishlist(storeId: string): Promise<WishlistState> {
  const token = await readWishlistToken(storeId);

  if (token) {
    await deleteWishlist(storeId, token);
    // The rows are gone, so the cookie identifies an empty list. Dropping it
    // leaves the shopper as they arrived rather than tagged for a year.
    await forgetWishlistToken(storeId);
  }

  return EMPTY_WISHLIST_STATE;
}

async function getWishlistStateForToken(storeId: string, token: string): Promise<WishlistState> {
  const rows = await findWishlistRows(storeId, token);

  return {
    count: rows.length,
    productIds: rows.map((row) => row.productId)
  };
}

async function requirePublicProduct(storeId: string, productId: string) {
  const [product] = await getStorefrontProductsByIds(storeId, [productId]);

  if (!product) {
    throw new Error("This product is not available.");
  }

  return product;
}
