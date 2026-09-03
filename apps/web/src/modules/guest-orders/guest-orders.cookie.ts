import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * How long a purchase is remembered on the device that made it.
 *
 * Three days is not a storage limit, it is the promise: a shopper who ordered
 * this morning wants to see where it is tonight and tomorrow, and nobody wants
 * their name, phone number and street address still sitting on a shared phone a
 * week later. The window is measured from the **order**, not from the last
 * visit, so it cannot be extended by browsing — otherwise a bookmarked account
 * page would keep one purchase on screen indefinitely.
 */
export const GUEST_ORDER_WINDOW_DAYS = 3;
export const GUEST_ORDER_WINDOW_MS = GUEST_ORDER_WINDOW_DAYS * 24 * 60 * 60 * 1000;

const GUEST_ORDERS_COOKIE_PREFIX = "dash_orders";
const GUEST_ORDERS_VERSION = 1;
/**
 * A ceiling, not a policy. Four bytes of cookie per order is nothing, but a
 * cookie is sent on every request to the shop and there is no reason for a
 * scripted checkout to be able to grow one without bound.
 */
const GUEST_ORDERS_MAX = 20;

/**
 * One remembered purchase: which order, and when it was placed.
 *
 * The id and the timestamp are **all** the cookie carries. Names, addresses,
 * totals and statuses stay in the database and are re-read on every render —
 * the same rule the wishlist cookie follows, and for a stronger reason here.
 * A copied status is wrong the moment the seller touches the order, and the
 * whole point of this page is to show a shopper the status.
 */
export type GuestOrderRef = {
  /** Epoch ms the order was placed. The window is measured from this. */
  at: number;
  id: string;
};

type GuestOrdersPayload = {
  orders: GuestOrderRef[];
  storeId: string;
  version: number;
};

export function guestOrdersCookieName(storeId: string) {
  return `${GUEST_ORDERS_COOKIE_PREFIX}_${storeId}`;
}

export function guestOrderExpiresAt(ref: GuestOrderRef) {
  return ref.at + GUEST_ORDER_WINDOW_MS;
}

/**
 * What is still inside the window, newest first.
 *
 * Takes `unknown[]` on purpose: the entries come off a cookie, and a signature
 * proves this server wrote the string, not that the string still means what a
 * later version of this file expects. Each entry is re-derived rather than cast.
 *
 * An order dated in the future is dropped rather than trusted. Nothing writes
 * one, but a clock that moved backwards would otherwise pin a purchase on the
 * page for as long as the drift lasts, and this list has exactly one job.
 */
export function pruneGuestOrders(orders: readonly unknown[], now: number): GuestOrderRef[] {
  const seen = new Set<string>();

  return orders
    .map(normalizeRef)
    .filter((ref): ref is GuestOrderRef => Boolean(ref))
    .filter((ref) => ref.at <= now && now - ref.at < GUEST_ORDER_WINDOW_MS)
    .filter((ref) => {
      if (seen.has(ref.id)) {
        return false;
      }

      seen.add(ref.id);

      return true;
    })
    .sort((first, second) => second.at - first.at)
    .slice(0, GUEST_ORDERS_MAX);
}

/**
 * The list with one more purchase on it.
 *
 * A repeat of an id replaces rather than appends — a double-tapped submit comes
 * back through here as the same order it always was, and the account page must
 * not list one purchase twice because the shopper's connection dropped.
 */
export function rememberGuestOrderRef(
  orders: readonly unknown[],
  ref: GuestOrderRef,
  now: number
): GuestOrderRef[] {
  return pruneGuestOrders([ref, ...orders], now);
}

/**
 * How long the browser should keep the cookie: until the newest order ages out.
 *
 * The browser dropping it is a convenience, never the guarantee — a cookie that
 * comes back anyway is still filtered by `pruneGuestOrders` on the server, which
 * is what makes "gone in three days" true rather than hopeful.
 */
export function guestOrdersCookieMaxAge(orders: readonly GuestOrderRef[], now: number) {
  const furthest = orders.reduce((latest, ref) => Math.max(latest, guestOrderExpiresAt(ref)), 0);

  return Math.max(0, Math.ceil((furthest - now) / 1000));
}

export function encodeGuestOrders(storeId: string, orders: readonly GuestOrderRef[]) {
  const payload: GuestOrdersPayload = {
    orders: orders.map((ref) => ({ at: ref.at, id: ref.id })),
    storeId,
    version: GUEST_ORDERS_VERSION
  };
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");

  return `${data}.${sign(data)}`;
}

/**
 * The remembered purchases in a cookie, or none.
 *
 * Signed, so the cookie cannot be edited into somebody else's order id, and
 * bound to the store it was written for, so one shop's cookie replayed at
 * another shop on the platform resolves to nothing rather than to whatever
 * order happens to share the id.
 */
export function decodeGuestOrders(value: string, storeId: string, now: number): GuestOrderRef[] {
  const separator = value.lastIndexOf(".");

  if (separator < 1) {
    return [];
  }

  const data = value.slice(0, separator);
  const signature = value.slice(separator + 1);

  if (!isValidSignature(data, signature)) {
    return [];
  }

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString("utf8")
    ) as GuestOrdersPayload;

    if (payload.version !== GUEST_ORDERS_VERSION || payload.storeId !== storeId) {
      return [];
    }

    return pruneGuestOrders(Array.isArray(payload.orders) ? payload.orders : [], now);
  } catch {
    return [];
  }
}

function normalizeRef(entry: unknown): GuestOrderRef | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const { at, id } = entry as { at?: unknown; id?: unknown };
  const placedAt = Number(at);

  if (typeof id !== "string" || !id || !Number.isFinite(placedAt)) {
    return null;
  }

  return { at: placedAt, id: id.slice(0, 64) };
}

function sign(data: string) {
  return createHmac("sha256", guestOrdersSecret()).update(data).digest("base64url");
}

function isValidSignature(data: string, signature: string) {
  const expected = Buffer.from(sign(data));
  const actual = Buffer.from(signature);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function guestOrdersSecret() {
  return process.env.NEXTAUTH_SECRET ?? "dash-commerce-local-guest-orders-secret";
}
