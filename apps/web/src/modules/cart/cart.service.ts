import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { prisma } from "@dash/db";
import { cookies } from "next/headers";
import {
  discardCartSnapshot,
  findAbandonedCartSnapshot,
  trackCartActivity
} from "../abandoned-carts/abandoned-cart.service";
import { getProductVariantForCart } from "../products/product-variants.service";
import type { Cart, StoredCart, StoredCartItem } from "./cart.types";

const CART_COOKIE_PREFIX = "dash_cart";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const CART_VERSION = 1;
const CART_NOTE_MAX_LENGTH = 1000;

type CartCookiePayload = Omit<StoredCart, "token"> & {
  /** Absent on cookies written before cart snapshots existed. */
  token?: string;
  version: number;
};

export async function getCart(storeId: string): Promise<Cart> {
  const cart = await readStoredCart(storeId);

  return buildCart(storeId, cart.items, cart.note);
}

/** The cart's snapshot key, so checkout can settle the snapshot it belongs to. */
export async function getCartToken(storeId: string) {
  const cart = await readStoredCart(storeId);

  return cart.token;
}

/** Order note from the cart page or mini cart drawer; carried into checkout. */
export async function setCartNote(storeId: string, note: string) {
  const currentCart = await readStoredCart(storeId);

  await writeStoredCart(currentCart, currentCart.items, note);

  return getCart(storeId);
}

export async function addToCart(storeId: string, productId: string, quantity: number, variantId?: string | null) {
  const requestedQuantity = normalizeQuantity(quantity);
  const product = await getPublicProductForCart(storeId, productId);
  const currentCart = await readStoredCart(storeId);
  const variant = variantId ? await getActiveCartVariant(storeId, product.id, variantId) : null;
  const lineId = cartLineId(product.id, variant?.id);
  const existingItem = currentCart.items.find((item) => item.lineId === lineId);
  const nextQuantity = (existingItem?.quantity ?? 0) + requestedQuantity;
  const availableStock = variant?.continueSelling ? Number.MAX_SAFE_INTEGER : variant?.stockQuantity ?? product.stockQuantity;

  ensureStockAllows(availableStock, nextQuantity);

  const image = variant?.imageUrl || product.images[0]?.url || null;
  const nextItem: StoredCartItem = {
    lineId,
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
  const currentCart = await readStoredCart(storeId);
  const currentItem = currentCart.items.find((item) => item.lineId === lineId || item.productId === lineId);

  if (!currentItem) {
    throw new Error("Cart item not found.");
  }

  const product = await getPublicProductForCart(storeId, currentItem.productId);
  const variant = currentItem.variantId ? await getActiveCartVariant(storeId, product.id, currentItem.variantId) : null;
  const availableStock = variant?.continueSelling ? Number.MAX_SAFE_INTEGER : variant?.stockQuantity ?? product.stockQuantity;

  ensureStockAllows(availableStock, nextQuantity);

  const nextItems = currentCart.items.map((item) =>
    item.lineId === currentItem.lineId ? { ...item, quantity: nextQuantity } : item
  );

  await writeStoredCart(currentCart, nextItems, currentCart.note);

  return getCart(storeId);
}

export async function removeCartItem(storeId: string, lineId: string) {
  const currentCart = await readStoredCart(storeId);
  const nextItems = currentCart.items.filter((item) => item.lineId !== lineId && item.productId !== lineId);

  await writeStoredCart(currentCart, nextItems, currentCart.note);

  return getCart(storeId);
}

export async function clearCart(storeId: string) {
  const currentCart = await readStoredCart(storeId);
  const cookieStore = await cookies();

  cookieStore.delete(cookieName(storeId));

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

async function readStoredCart(storeId: string): Promise<StoredCart> {
  const cookieStore = await cookies();
  const value = cookieStore.get(cookieName(storeId))?.value;
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

async function writeStoredCart(cart: StoredCart, items: StoredCartItem[], note: string) {
  const cookieStore = await cookies();
  const payload: CartCookiePayload = {
    version: CART_VERSION,
    storeId: cart.storeId,
    items: items.slice(0, 50),
    note: normalizeNote(note),
    token: cart.token
  };

  cookieStore.set(cookieName(cart.storeId), encodeCartCookie(payload), {
    httpOnly: true,
    maxAge: CART_COOKIE_MAX_AGE,
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
    quantity
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

function cookieName(storeId: string) {
  return `${CART_COOKIE_PREFIX}_${storeId}`;
}

function moneyString(value: number) {
  return value.toFixed(2);
}
