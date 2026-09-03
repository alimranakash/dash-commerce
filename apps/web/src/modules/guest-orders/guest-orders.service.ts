import { cookies } from "next/headers";
import {
  decodeGuestOrders,
  encodeGuestOrders,
  guestOrdersCookieMaxAge,
  guestOrdersCookieName,
  rememberGuestOrderRef
} from "./guest-orders.cookie";
import { findGuestOrdersByIds } from "./guest-orders.repository";
import { buildGuestAccountView, type GuestAccountView } from "./guest-orders.render";

/**
 * Order history for a shopper who never made an account.
 *
 * A storefront has no customer login, so the only identity available is the
 * device — the position the cart and the wishlist are already in, and this gives
 * the same answer: a signed, http-only cookie named per store.
 *
 * What it stores is the whole design. The cookie carries **order ids and the
 * moment each was placed, and nothing else**; the name, the address, the totals
 * and above all the status are re-read from the database on every render. The
 * alternative — pasting the order into the cookie at checkout — is what makes
 * this kind of feature lie: the seller marks the order shipped, the courier
 * picks it up, and the page keeps telling the customer "payment pending" from a
 * snapshot taken at the moment of purchase, on the one screen they opened
 * precisely to find out. It would also mean a shopper's phone number and street
 * address travelling in a cookie on every request to the shop.
 *
 * Three days, measured from each order rather than from the last visit, and
 * enforced on the server as well as by the cookie's own lifetime.
 */
export async function rememberGuestOrder(storeId: string, order: { createdAt: Date; id: string }) {
  const now = Date.now();
  const cookieStore = await cookies();
  const existing = decodeGuestOrders(
    cookieStore.get(guestOrdersCookieName(storeId))?.value ?? "",
    storeId,
    now
  );
  const orders = rememberGuestOrderRef(
    existing,
    { at: order.createdAt.getTime(), id: order.id },
    now
  );

  cookieStore.set(guestOrdersCookieName(storeId), encodeGuestOrders(storeId, orders), {
    httpOnly: true,
    maxAge: guestOrdersCookieMaxAge(orders, now),
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production"
  });
}

/**
 * The account page's contents, or null when this device has bought nothing.
 *
 * Read-only on purpose. Expired entries are dropped in memory rather than
 * written back, both because a page render is where Next forbids setting a
 * cookie and because the filter is the guarantee: a cookie that outlives its
 * window — restored from a backup, replayed by hand — still resolves to nothing
 * here.
 *
 * Orders the ids no longer resolve to simply do not appear. A seller who deleted
 * an order has deleted it, and this page is the last place that should argue.
 */
export async function getGuestAccountView(storeId: string): Promise<GuestAccountView | null> {
  const now = Date.now();
  const cookieStore = await cookies();
  const refs = decodeGuestOrders(
    cookieStore.get(guestOrdersCookieName(storeId))?.value ?? "",
    storeId,
    now
  );

  if (refs.length === 0) {
    return null;
  }

  const orders = await findGuestOrdersByIds(
    storeId,
    refs.map((ref) => ref.id)
  );

  return buildGuestAccountView(orders, refs, now);
}

/**
 * The shopper's own "not my phone" button.
 *
 * Cash on delivery is bought on shared handsets, and a receipt carrying a name,
 * a phone number and a street address should not need three days and somebody
 * else's patience to disappear. Deletes the cookie only — the order is the
 * shop's record and is untouched.
 */
export async function forgetGuestOrders(storeId: string) {
  const cookieStore = await cookies();

  cookieStore.delete(guestOrdersCookieName(storeId));
}
