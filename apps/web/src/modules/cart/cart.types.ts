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
