import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Who a wishlist belongs to.
 *
 * A storefront has no shopper login, so the only identity available is a cookie
 * — the same position the cart is in, and the same answer it gives: an opaque
 * token, signed so it cannot be edited into somebody else's list, and named per
 * store so one shopper's list on two shops on this platform are two unrelated
 * lists.
 *
 * The token is all the cookie carries. Titles and prices stay in the database
 * and are re-read on every render, because a wishlist is looked at weeks after
 * it is filled and a copied price is wrong by then.
 */
const WISHLIST_COOKIE_PREFIX = "dash_wishlist";
/**
 * A year. Longer than the cart's month on purpose: a cart is this afternoon's
 * shopping and a wishlist is the thing a shopper comes back to at payday.
 */
const WISHLIST_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function wishlistCookieName(storeId: string) {
  return `${WISHLIST_COOKIE_PREFIX}_${storeId}`;
}

/**
 * The shopper's token, or null when they have never saved anything.
 *
 * Never mints one. Reads happen during page render, where Next refuses to let a
 * cookie be set, and a browse that writes a tracking cookie to nobody's benefit
 * is not something a storefront should do anyway.
 */
export async function readWishlistToken(storeId: string): Promise<string | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(wishlistCookieName(storeId))?.value;

  return value ? decodeWishlistToken(value) : null;
}

/**
 * The shopper's token, minting and setting one if this is their first save.
 *
 * Route handlers and server actions only — it writes a cookie, which is exactly
 * what a page render may not do.
 */
export async function requireWishlistToken(storeId: string): Promise<string> {
  const existing = await readWishlistToken(storeId);

  if (existing) {
    return existing;
  }

  const token = randomUUID();
  const cookieStore = await cookies();

  cookieStore.set(wishlistCookieName(storeId), encodeWishlistToken(token), {
    httpOnly: true,
    maxAge: WISHLIST_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });

  return token;
}

export async function forgetWishlistToken(storeId: string) {
  const cookieStore = await cookies();

  cookieStore.delete(wishlistCookieName(storeId));
}

function encodeWishlistToken(token: string) {
  return `${token}.${sign(token)}`;
}

function decodeWishlistToken(value: string): string | null {
  const separator = value.lastIndexOf(".");

  if (separator < 1) {
    return null;
  }

  const token = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  return isValidSignature(token, signature) ? token : null;
}

function sign(data: string) {
  return createHmac("sha256", wishlistSecret()).update(data).digest("base64url");
}

function isValidSignature(data: string, signature: string) {
  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function wishlistSecret() {
  return process.env.NEXTAUTH_SECRET ?? "dash-commerce-local-wishlist-secret";
}
