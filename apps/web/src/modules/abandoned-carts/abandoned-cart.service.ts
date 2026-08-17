import type { Prisma } from "@dash/db";
import { PLATFORM_ROOT_DOMAIN } from "../../lib/host-routing";
import type { StoredCartItem } from "../cart/cart.types";
import {
  abandonedCartContactSchema,
  markAbandonedCartContactedSchema,
  markAbandonedCartRecoveredSchema,
  type AbandonedCartContactInput
} from "./abandoned-cart.schema";
import {
  countActiveAbandonedCarts,
  deleteActiveAbandonedCart,
  findAbandonedCartByToken,
  findCustomerIdByPhone,
  findPrimaryStoreDomain,
  getAbandonedCartRecords,
  markAbandonedCartRecovered,
  updateAbandonedCartContact,
  updateAbandonedCartStatus,
  upsertAbandonedCartSnapshot,
  type AbandonedCartListRecord
} from "./abandoned-cart.repository";
import type {
  AbandonedCartLine,
  AbandonedCartListFilters,
  AbandonedCartRecord,
  AbandonedCartStatus
} from "./abandoned-cart.types";

/**
 * How long a cart has to sit untouched before it counts as abandoned.
 *
 * There is no background job behind this: a cart is abandoned by virtue of its
 * last write being old enough, so the dashboard derives the state at read time
 * and nothing has to run on a schedule for the number to be right.
 */
const DEFAULT_INACTIVITY_MINUTES = 60;

export function getAbandonedCartInactivityMinutes() {
  const configured = Number(process.env.ABANDONED_CART_INACTIVITY_MINUTES);

  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_INACTIVITY_MINUTES;
}

export function getAbandonedCartCutoff(now = new Date()) {
  return new Date(now.getTime() - getAbandonedCartInactivityMinutes() * 60_000);
}

type CartActivityInput = {
  items: StoredCartItem[];
  note: string;
  storeId: string;
  token: string;
};

/**
 * Mirrors a cart write into the snapshot table.
 *
 * Never rejects: cart tracking is a side effect of shopping, and a snapshot
 * failure must not turn an "add to cart" into an error for the customer.
 */
export async function trackCartActivity(input: CartActivityInput) {
  try {
    if (input.items.length === 0) {
      await deleteActiveAbandonedCart(input.storeId, input.token);
      return;
    }

    await upsertAbandonedCartSnapshot({
      itemCount: input.items.reduce((total, item) => total + item.quantity, 0),
      // The stored items are plain JSON already; the cast only satisfies the
      // structural difference between our optional props and Prisma's JSON input.
      items: input.items as unknown as Prisma.InputJsonValue,
      note: input.note,
      storeId: input.storeId,
      subtotalAmount: cartSubtotal(input.items),
      token: input.token
    });
  } catch (error) {
    console.error("Failed to record abandoned cart snapshot", error);
  }
}

/** Called when the shopper empties or clears the cart themselves. */
export async function discardCartSnapshot(storeId: string, token: string) {
  try {
    await deleteActiveAbandonedCart(storeId, token);
  } catch (error) {
    console.error("Failed to discard abandoned cart snapshot", error);
  }
}

/**
 * Keeps the contact details a shopper typed into checkout.
 *
 * This is the only point in the funnel where a guest identifies themselves, so
 * it runs before the order transaction: a checkout that then fails on stock or
 * payment still leaves the seller someone to call.
 */
export async function captureCheckoutContact(
  storeId: string,
  token: string,
  contact: AbandonedCartContactInput
) {
  try {
    const data = abandonedCartContactSchema.parse(contact);
    const customerId = data.phone ? await findCustomerIdByPhone(storeId, data.phone) : null;

    await updateAbandonedCartContact(storeId, token, {
      customerEmail: data.email ?? null,
      customerId,
      customerName: data.name ?? null,
      customerPhone: data.phone ?? null
    });
  } catch (error) {
    console.error("Failed to capture abandoned cart contact", error);
  }
}

/**
 * Settles a snapshot once its checkout succeeds.
 *
 * A cart that converted while the shopper was still active was never abandoned,
 * so it is dropped. One that had already gone quiet — or that the seller had
 * contacted — is a genuine recovery and is kept as such.
 */
export async function resolveCartAfterCheckout(
  storeId: string,
  token: string,
  order: { id: string; orderNumber: string }
) {
  try {
    const snapshot = await findAbandonedCartByToken(storeId, token);

    if (!snapshot) {
      return;
    }

    const wasAbandoned =
      snapshot.status !== "NOT_CONTACTED" || snapshot.lastActivityAt <= getAbandonedCartCutoff();

    if (!wasAbandoned) {
      await deleteActiveAbandonedCart(storeId, token);
      return;
    }

    await markAbandonedCartRecovered(storeId, token, order);
  } catch (error) {
    console.error("Failed to resolve abandoned cart after checkout", error);
  }
}

/** Carts still being shopped, which the abandoned list intentionally excludes. */
export async function countActiveCarts(storeId: string) {
  return countActiveAbandonedCarts(storeId, getAbandonedCartCutoff());
}

/** The stored cart behind a recovery link. */
export async function findAbandonedCartSnapshot(storeId: string, token: string) {
  const snapshot = await findAbandonedCartByToken(storeId, token);

  if (!snapshot) {
    return null;
  }

  return {
    items: toStoredCartItems(snapshot.items),
    note: snapshot.note ?? ""
  };
}

export async function listAbandonedCarts(
  store: { currency: string; id: string; slug: string },
  filters: AbandonedCartListFilters = {}
): Promise<AbandonedCartRecord[]> {
  const [records, origin] = await Promise.all([
    getAbandonedCartRecords({
      cutoff: getAbandonedCartCutoff(),
      dateRange: filters.dateRange,
      limit: filters.limit,
      search: filters.search,
      storeId: store.id
    }),
    getStorefrontOrigin(store)
  ]);

  return records.map((record) => toAbandonedCartRecord(record, store.currency, origin));
}

export async function markAbandonedCartContacted(
  storeId: string,
  input: { cartId: string; channel?: string | undefined }
) {
  const data = markAbandonedCartContactedSchema.parse({
    cartId: input.cartId,
    ...(input.channel ? { channel: input.channel } : {})
  });
  const result = await updateAbandonedCartStatus(storeId, data.cartId, {
    contactChannel: data.channel,
    contactedAt: new Date(),
    status: "CONTACTED"
  });

  if (result.count === 0) {
    throw new Error("Abandoned cart not found.");
  }
}

/**
 * The seller's manual "this one came back" override, for a recovery that
 * happened off-platform (a phone order, a resent payment link).
 */
export async function markAbandonedCartRecoveredManually(
  storeId: string,
  input: { cartId: string }
) {
  const data = markAbandonedCartRecoveredSchema.parse(input);
  const result = await updateAbandonedCartStatus(storeId, data.cartId, {
    recoveredAt: new Date(),
    status: "RECOVERED"
  });

  if (result.count === 0) {
    throw new Error("Abandoned cart not found.");
  }
}

/**
 * Where a recovery link has to point.
 *
 * The cart cookie is scoped to the storefront hostname, so a link back to the
 * seller app would restore nothing — it has to be the store's own origin.
 */
export async function getStorefrontOrigin(store: { id: string; slug: string }) {
  const domain = await findPrimaryStoreDomain(store.id);

  return {
    href: `https://${domain?.domain ?? `${store.slug}.${PLATFORM_ROOT_DOMAIN}`}`,
    slug: store.slug
  };
}

function toAbandonedCartRecord(
  record: AbandonedCartListRecord,
  fallbackCurrency: string,
  origin: { href: string; slug: string }
): AbandonedCartRecord {
  return {
    cartValue: Number(record.subtotalAmount),
    currency: fallbackCurrency,
    customerName: record.customerName?.trim() || "Guest shopper",
    email: record.customerEmail,
    id: record.id,
    items: toCartLines(record.items),
    lastActivity: record.lastActivityAt.toISOString(),
    phone: record.customerPhone,
    recoveryUrl: `${origin.href}/api/cart/recover?store=${encodeURIComponent(origin.slug)}&token=${encodeURIComponent(record.token)}`,
    status: record.status as AbandonedCartStatus
  };
}

function toCartLines(items: unknown): AbandonedCartLine[] {
  return toStoredCartItems(items).map((item, index) => ({
    id: item.lineId || item.productId || String(index),
    price: Number(item.price) || 0,
    productName: item.variantTitle ? `${item.title} - ${item.variantTitle}` : item.title,
    quantity: item.quantity
  }));
}

/** The stored items are a JSON column, so nothing about their shape is guaranteed. */
function toStoredCartItems(items: unknown): StoredCartItem[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.flatMap((entry) => {
    if (!entry || typeof entry !== "object") {
      return [];
    }

    const item = entry as Partial<StoredCartItem>;
    const quantity = Math.floor(Number(item.quantity));

    if (!item.productId || !item.title || !Number.isFinite(quantity) || quantity < 1) {
      return [];
    }

    return [
      {
        image: item.image ? String(item.image) : null,
        lineId: String(item.lineId ?? item.productId),
        price: String(item.price ?? "0"),
        productId: String(item.productId),
        quantity,
        sku: item.sku ? String(item.sku) : null,
        title: String(item.title),
        variantId: item.variantId ? String(item.variantId) : null,
        variantTitle: item.variantTitle ? String(item.variantTitle) : null
      }
    ];
  });
}

function cartSubtotal(items: StoredCartItem[]) {
  return items.reduce((total, item) => total + Number(item.price) * item.quantity, 0).toFixed(2);
}
