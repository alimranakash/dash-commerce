import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@dash/db";
import { cookies } from "next/headers";
import type { AbandonedCartCheckoutDraftInput } from "../abandoned-carts/abandoned-cart.schema";
import {
  captureCheckoutDraft,
  discardCartSnapshot,
  findAbandonedCartSnapshot,
  trackCartActivity
} from "../abandoned-carts/abandoned-cart.service";
import { getProductVariantForCart } from "../products/product-variants.service";
import {
  parseCartItemSource,
  type Cart,
  type CartItemSource,
  type CartScope,
  type StoredCart,
  type StoredCartItem
} from "./cart.types";

const CART_COOKIE_PREFIX = "dash_cart";
const DIRECT_COOKIE_PREFIX = "dash_direct";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
/**
 * A direct basket is one trip through checkout, not a basket to come back to.
 *
 * Long enough to fill the form in, look up a transaction id and hesitate;
 * short enough that a bookmarked `?buy=direct` opened next week is an expired
 * session rather than a surprise order for whatever the shopper was looking at
 * that day.
 */
const DIRECT_COOKIE_MAX_AGE = 60 * 60 * 2;
const CART_VERSION = 1;
const CART_NOTE_MAX_LENGTH = 1000;

type CartCookiePayload = Omit<StoredCart, "token"> & {
  /** Absent on cookies written before cart snapshots existed. */
  token?: string;
  version: number;
};

export async function getCart(storeId: string, scope: CartScope = "cart"): Promise<Cart> {
  const cart = await readStoredCart(storeId, scope);

  return buildCart(storeId, cart.items, cart.note);
}

/** The cart's snapshot key, so checkout can settle the snapshot it belongs to. */
export async function getCartToken(storeId: string, scope: CartScope = "cart") {
  const cart = await readStoredCart(storeId, scope);

  return cart.token;
}

/**
 * Opens a Direct Checkout: one product, in a basket of its own.
 *
 * Validated exactly as an add is — the product has to be public, the variant
 * active, the stock has to cover it — because this is the only check the line
 * gets before it becomes an order, and a direct buy skips the cart page where
 * the shopper would otherwise have seen the problem.
 *
 * It **replaces** rather than merges. "Buy just this one" said twice is still
 * one of whatever was said second, and a merge would quietly resurrect the
 * product from an abandoned direct buy the shopper never came back to.
 *
 * The token is fresh for the same reason: this basket's abandoned-cart snapshot
 * is its own lead, and settling it must not settle the shopper's real cart.
 */
export async function startDirectCheckout(
  storeId: string,
  productId: string,
  quantity: number,
  variantId?: string | null
) {
  const requestedQuantity = normalizeQuantity(quantity);
  const product = await getPublicProductForCart(storeId, productId);
  const variant = variantId ? await getActiveCartVariant(storeId, product.id, variantId) : null;

  ensureStockAllows(availableStockFor(product, variant), requestedQuantity);

  const item: StoredCartItem = {
    lineId: cartLineId(product.id, variant?.id),
    source: "CART",
    productId: product.id,
    sku: variant?.sku ?? product.sku ?? null,
    title: product.title,
    variantId: variant?.id ?? null,
    variantTitle: variant?.title ?? null,
    price: variant?.price ?? product.price.toString(),
    image: variant?.imageUrl || product.images[0]?.url || null,
    quantity: requestedQuantity
  };

  await writeStoredCart(
    { items: [], note: "", storeId, token: createCartToken() },
    [item],
    "",
    "direct"
  );

  return getCart(storeId, "direct");
}

/**
 * Saves what a shopper has typed into checkout, before they submit anything.
 *
 * Most abandoned checkouts never reach the submit handler, so waiting for the
 * order attempt loses exactly the details that make one recoverable — who they
 * are, and where the parcel was going. The snapshot is (re)written first, both
 * to guarantee a row exists to attach the draft to and because typing is
 * activity — a shopper mid-checkout must not age into the incomplete list while
 * they are still there.
 */
export async function recordCheckoutDraft(
  storeId: string,
  draft: AbandonedCartCheckoutDraftInput,
  context: { ipAddress: string | null },
  scope: CartScope = "cart"
) {
  const cart = await readStoredCart(storeId, scope);

  if (cart.items.length === 0) {
    return false;
  }

  await trackCartActivity({
    items: cart.items,
    note: cart.note,
    storeId,
    token: cart.token
  });
  await captureCheckoutDraft(storeId, cart.token, draft, context);

  return true;
}

/** Order note from the cart page or mini cart drawer; carried into checkout. */
export async function setCartNote(storeId: string, note: string) {
  const currentCart = await readStoredCart(storeId, "cart");

  await writeStoredCart(currentCart, currentCart.items, note);

  return getCart(storeId);
}

/**
 * How many of a line the shopper may hold, which is not always what is on the
 * shelf.
 *
 * A product taking pre-orders has no ceiling, and neither does an option the
 * seller set to keep selling. Both are the same promise to the buyer — it is
 * coming, just not yet — and the storefront says so beside the button.
 */
function availableStockFor(
  product: { allowPreorder: boolean; stockQuantity: number },
  variant: { continueSelling?: boolean; stockQuantity: number } | null
) {
  if (product.allowPreorder || variant?.continueSelling) {
    return Number.MAX_SAFE_INTEGER;
  }

  return variant?.stockQuantity ?? product.stockQuantity;
}

/**
 * `source` records which surface asked for the add, for the merchandising
 * report. It is only ever set when the line is created: a shopper who took a
 * suggestion and then raised its quantity on the cart page took the suggestion,
 * and the rail never offers something already in the cart, so a merge can only
 * mean the line was already the shopper's own.
 */
export async function addToCart(
  storeId: string,
  productId: string,
  quantity: number,
  variantId?: string | null,
  source: CartItemSource = "CART"
) {
  const requestedQuantity = normalizeQuantity(quantity);
  const product = await getPublicProductForCart(storeId, productId);
  const currentCart = await readStoredCart(storeId, "cart");
  const variant = variantId ? await getActiveCartVariant(storeId, product.id, variantId) : null;
  const lineId = cartLineId(product.id, variant?.id);
  const existingItem = currentCart.items.find((item) => item.lineId === lineId);
  const nextQuantity = (existingItem?.quantity ?? 0) + requestedQuantity;

  ensureStockAllows(availableStockFor(product, variant), nextQuantity);

  const image = variant?.imageUrl || product.images[0]?.url || null;
  const nextItem: StoredCartItem = {
    lineId,
    source: existingItem?.source ?? source,
    productId: product.id,
    sku: variant?.sku ?? product.sku ?? null,
    title: product.title,
    variantId: variant?.id ?? null,
    variantTitle: variant?.title ?? null,
    price: variant?.price ?? product.price.toString(),
    image,
    quantity: nextQuantity
  };

  await writeStoredCart(currentCart, upsertItem(currentCart.items, nextItem), currentCart.note);

  return getCart(storeId);
}

export async function updateCartItemQuantity(
  storeId: string,
  lineId: string,
  quantity: number
) {
  const nextQuantity = normalizeQuantity(quantity);
  const currentCart = await readStoredCart(storeId, "cart");
  const currentItem = currentCart.items.find((item) => item.lineId === lineId || item.productId === lineId);

  if (!currentItem) {
    throw new Error("Cart item not found.");
  }

  const product = await getPublicProductForCart(storeId, currentItem.productId);
  const variant = currentItem.variantId ? await getActiveCartVariant(storeId, product.id, currentItem.variantId) : null;

  ensureStockAllows(availableStockFor(product, variant), nextQuantity);

  const nextItems = currentCart.items.map((item) =>
    item.lineId === currentItem.lineId ? { ...item, quantity: nextQuantity } : item
  );

  await writeStoredCart(currentCart, nextItems, currentCart.note);

  return getCart(storeId);
}

export async function removeCartItem(storeId: string, lineId: string) {
  const currentCart = await readStoredCart(storeId, "cart");
  const nextItems = currentCart.items.filter((item) => item.lineId !== lineId && item.productId !== lineId);

  await writeStoredCart(currentCart, nextItems, currentCart.note);

  return getCart(storeId);
}

export async function clearCart(storeId: string, scope: CartScope = "cart") {
  const currentCart = await readStoredCart(storeId, scope);
  const cookieStore = await cookies();

  cookieStore.delete(cookieName(storeId, scope));

  // Only drops a snapshot that is still open — a cart already settled as
  // recovered by checkout stays in the seller's recovery history.
  await discardCartSnapshot(storeId, currentCart.token);

  return buildCart(storeId, [], "");
}

/**
 * Rebuilds the cart cookie from a snapshot, so a recovery link a seller sent
 * lands the shopper back on the cart they left — on whatever device they open
 * it on. The snapshot keeps its token, so completing checkout from here still
 * settles the same row as a recovery.
 */
export async function restoreCartFromSnapshot(storeId: string, token: string) {
  const snapshot = await findAbandonedCartSnapshot(storeId, token);

  if (!snapshot || snapshot.items.length === 0) {
    return null;
  }

  await writeStoredCart({ items: [], note: "", storeId, token }, snapshot.items, snapshot.note);

  return getCart(storeId);
}

export function calculateCartTotals(items: StoredCartItem[]) {
  const subtotal = items.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  return {
    itemCount,
    subtotal: moneyString(subtotal)
  };
}

function buildCart(storeId: string, items: StoredCartItem[], note: string): Cart {
  const normalizedItems = items.map((item) => ({
    ...item,
    lineId: item.lineId ?? cartLineId(item.productId, item.variantId),
    lineTotal: moneyString(Number(item.price) * item.quantity)
  }));

  return {
    storeId,
    items: normalizedItems,
    note,
    totals: calculateCartTotals(items)
  };
}

async function getPublicProductForCart(storeId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      storeId,
      status: "ACTIVE",
      visibility: "PUBLIC"
    },
    include: {
      images: {
        orderBy: {
          position: "asc"
        },
        take: 1
      }
    }
  });

  if (!product) {
    throw new Error("This product is not available.");
  }

  return product;
}

async function readStoredCart(storeId: string, scope: CartScope): Promise<StoredCart> {
  const cookieStore = await cookies();
  const value = cookieStore.get(cookieName(storeId, scope))?.value;
  const payload = value ? decodeCartCookie(value) : null;

  if (!payload || payload.storeId !== storeId) {
    return {
      storeId,
      items: [],
      note: "",
      token: createCartToken()
    };
  }

  return {
    storeId,
    items: payload.items
      .map(normalizeStoredItem)
      .filter((item): item is StoredCartItem => Boolean(item)),
    note: normalizeNote(payload.note),
    // Carts written before snapshots existed have no token; they get one on
    // their next write rather than being dropped by a cookie version bump.
    token: typeof payload.token === "string" && payload.token ? payload.token : createCartToken()
  };
}

async function writeStoredCart(
  cart: StoredCart,
  items: StoredCartItem[],
  note: string,
  scope: CartScope = "cart"
) {
  const cookieStore = await cookies();
  const payload: CartCookiePayload = {
    version: CART_VERSION,
    storeId: cart.storeId,
    items: items.slice(0, 50),
    note: normalizeNote(note),
    token: cart.token
  };

  cookieStore.set(cookieName(cart.storeId, scope), encodeCartCookie(payload), {
    httpOnly: true,
    maxAge: scope === "direct" ? DIRECT_COOKIE_MAX_AGE : CART_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  await trackCartActivity({
    items: payload.items,
    note: payload.note,
    storeId: cart.storeId,
    token: cart.token
  });
}

function upsertItem(items: StoredCartItem[], nextItem: StoredCartItem) {
  const exists = items.some((item) => item.lineId === nextItem.lineId);

  if (!exists) {
    return [...items, nextItem];
  }

  return items.map((item) => (item.lineId === nextItem.lineId ? nextItem : item));
}

function normalizeStoredItem(item: StoredCartItem): StoredCartItem | null {
  if (!item.productId || !item.title || !item.price) {
    return null;
  }

  const quantity = Math.floor(Number(item.quantity));

  if (!Number.isFinite(quantity) || quantity < 1) {
    return null;
  }

  return {
    lineId: item.lineId ? String(item.lineId) : cartLineId(String(item.productId), item.variantId ? String(item.variantId) : null),
    productId: String(item.productId),
    sku: item.sku ? String(item.sku) : null,
    title: String(item.title),
    variantId: item.variantId ? String(item.variantId) : null,
    variantTitle: item.variantTitle ? String(item.variantTitle) : null,
    price: moneyString(Number(item.price)),
    image: item.image ? String(item.image) : null,
    quantity,
    // Cookies written before this column existed carry no source, and their
    // lines were all the shopper's own doing.
    source: parseCartItemSource(item.source)
  };
}

async function getActiveCartVariant(storeId: string, productId: string, variantId: string) {
  return getProductVariantForCart(storeId, productId, variantId);
}

function cartLineId(productId: string, variantId?: string | null) {
  return variantId ? `${productId}:${variantId}` : productId;
}

function createCartToken() {
  return randomUUID();
}

function normalizeNote(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, CART_NOTE_MAX_LENGTH) : "";
}

function normalizeQuantity(quantity: number) {
  const nextQuantity = Math.floor(Number(quantity));

  if (!Number.isFinite(nextQuantity) || nextQuantity < 1) {
    throw new Error("Quantity must be at least 1.");
  }

  return nextQuantity;
}

function ensureStockAllows(stockQuantity: number, quantity: number) {
  if (quantity > stockQuantity) {
    throw new Error("Requested quantity exceeds available stock.");
  }
}

function encodeCartCookie(payload: CartCookiePayload) {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(data);

  return `${data}.${signature}`;
}

function decodeCartCookie(value: string): CartCookiePayload | null {
  const [data, signature] = value.split(".");

  if (!data || !signature || !isValidSignature(data, signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as CartCookiePayload;

    if (payload.version !== CART_VERSION || !Array.isArray(payload.items)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function sign(data: string) {
  return createHmac("sha256", cartSecret()).update(data).digest("base64url");
}

function isValidSignature(data: string, signature: string) {
  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function cartSecret() {
  return process.env.NEXTAUTH_SECRET ?? "dash-commerce-local-cart-secret";
}

function cookieName(storeId: string, scope: CartScope) {
  return `${scope === "direct" ? DIRECT_COOKIE_PREFIX : CART_COOKIE_PREFIX}_${storeId}`;
}

function moneyString(value: number) {
  return value.toFixed(2);
}
