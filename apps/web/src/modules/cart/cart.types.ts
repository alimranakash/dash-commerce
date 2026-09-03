/**
 * Which storefront surface put a line into the cart.
 *
 * Carried in the cookie and copied onto the order line at checkout, because
 * this is the only point where the answer is still known — afterwards the
 * order is one basket and every line looks the same.
 *
 * "ORDER_BUMP" is not here: the bump never enters a cart, it is added to the
 * order at checkout.
 */
export type CartItemSource = "CART" | "CART_CROSS_SELL";

export const CART_ITEM_SOURCES: readonly CartItemSource[] = ["CART", "CART_CROSS_SELL"];

/** Whatever a form posted, narrowed to a source the cart will record. */
export function parseCartItemSource(value: string | null | undefined): CartItemSource {
  return CART_ITEM_SOURCES.includes(value as CartItemSource) ? (value as CartItemSource) : "CART";
}

export type CartItem = {
  lineId: string;
  productId: string;
  sku?: string | null;
  title: string;
  variantId?: string | null;
  variantTitle?: string | null;
  price: string;
  image: string | null;
  quantity: number;
  lineTotal: string;
  source: CartItemSource;
};

export type CartTotals = {
  itemCount: number;
  subtotal: string;
};

export type Cart = {
  storeId: string;
  items: CartItem[];
  note: string;
  totals: CartTotals;
};

export type StoredCartItem = Omit<CartItem, "lineTotal">;

export type StoredCart = {
  storeId: string;
  items: StoredCartItem[];
  note: string;
  /**
   * Random per-cart id, carried in the cookie and used as the key of the
   * server-side snapshot the abandoned-cart dashboard reads.
   */
  token: string;
};

/**
 * Which basket a checkout is settling.
 *
 * "cart" is the shopper's own basket — the one the header counts and the cart
 * page edits. "direct" is the single-line basket a Direct Checkout opens: the
 * shopper said "just this one", so their real cart must neither be added to nor
 * billed, and it is still sitting there untouched when they come back.
 *
 * Two cookies rather than a flag on one, because the two baskets have to coexist
 * — a shopper with three things in their cart who buys a fourth directly still
 * has three things in their cart afterwards. Everything downstream of the read
 * is identical: a direct basket is a `Cart`, so bundles, coupons, the order
 * bump, free shipping and stock all price it through the same functions.
 */
export type CartScope = "cart" | "direct";

export const CART_SCOPES: readonly CartScope[] = ["cart", "direct"];

/**
 * Whatever a form or query string asked for, narrowed to a scope that exists.
 *
 * A closed enum rather than a trusted string: the scope picks which signed
 * cookie is read, and both of them are the server's own, so the worst an
 * invented value can do is settle the ordinary cart.
 */
export function parseCartScope(value: string | null | undefined): CartScope {
  return CART_SCOPES.includes(value as CartScope) ? (value as CartScope) : "cart";
}
