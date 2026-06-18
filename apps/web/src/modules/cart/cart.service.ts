import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@dash/db";
import { cookies } from "next/headers";
import type { Cart, StoredCart, StoredCartItem } from "./cart.types";

const CART_COOKIE_PREFIX = "dash_cart";
const CART_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;
const CART_VERSION = 1;

type CartCookiePayload = StoredCart & {
  version: number;
};

export async function getCart(storeId: string): Promise<Cart> {
  const cart = await readStoredCart(storeId);

  return buildCart(storeId, cart.items);
}

export async function addToCart(storeId: string, productId: string, quantity: number) {
  const requestedQuantity = normalizeQuantity(quantity);
  const product = await getPublicProductForCart(storeId, productId);
  const currentCart = await readStoredCart(storeId);
  const existingItem = currentCart.items.find((item) => item.productId === product.id);
  const nextQuantity = (existingItem?.quantity ?? 0) + requestedQuantity;

  ensureStockAllows(product.stockQuantity, nextQuantity);

  const image = product.images[0]?.url ?? null;
  const nextItem: StoredCartItem = {
    productId: product.id,
    title: product.title,
    price: product.price.toString(),
    image,
    quantity: nextQuantity
  };

  await writeStoredCart(storeId, upsertItem(currentCart.items, nextItem));

  return getCart(storeId);
}

export async function updateCartItemQuantity(
  storeId: string,
  productId: string,
  quantity: number
) {
  const nextQuantity = normalizeQuantity(quantity);
  const product = await getPublicProductForCart(storeId, productId);

  ensureStockAllows(product.stockQuantity, nextQuantity);

  const currentCart = await readStoredCart(storeId);
  const nextItems = currentCart.items.map((item) =>
    item.productId === productId ? { ...item, quantity: nextQuantity } : item
  );

  await writeStoredCart(storeId, nextItems);

  return getCart(storeId);
}

export async function removeCartItem(storeId: string, productId: string) {
  const currentCart = await readStoredCart(storeId);
  const nextItems = currentCart.items.filter((item) => item.productId !== productId);

  await writeStoredCart(storeId, nextItems);

  return getCart(storeId);
}

export async function clearCart(storeId: string) {
  const cookieStore = await cookies();

  cookieStore.delete(cookieName(storeId));

  return buildCart(storeId, []);
}

export function calculateCartTotals(items: StoredCartItem[]) {
  const subtotal = items.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  return {
    itemCount,
    subtotal: moneyString(subtotal)
  };
}

function buildCart(storeId: string, items: StoredCartItem[]): Cart {
  const normalizedItems = items.map((item) => ({
    ...item,
    lineTotal: moneyString(Number(item.price) * item.quantity)
  }));

  return {
    storeId,
    items: normalizedItems,
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
      items: []
    };
  }

  return {
    storeId,
    items: payload.items
      .map(normalizeStoredItem)
      .filter((item): item is StoredCartItem => Boolean(item))
  };
}

async function writeStoredCart(storeId: string, items: StoredCartItem[]) {
  const cookieStore = await cookies();
  const payload: CartCookiePayload = {
    version: CART_VERSION,
    storeId,
    items: items.slice(0, 50)
  };

  cookieStore.set(cookieName(storeId), encodeCartCookie(payload), {
    httpOnly: true,
    maxAge: CART_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

function upsertItem(items: StoredCartItem[], nextItem: StoredCartItem) {
  const exists = items.some((item) => item.productId === nextItem.productId);

  if (!exists) {
    return [...items, nextItem];
  }

  return items.map((item) => (item.productId === nextItem.productId ? nextItem : item));
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
    productId: String(item.productId),
    title: String(item.title),
    price: moneyString(Number(item.price)),
    image: item.image ? String(item.image) : null,
    quantity
  };
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
