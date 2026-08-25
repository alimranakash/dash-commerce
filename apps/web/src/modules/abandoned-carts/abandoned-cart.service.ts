import type { Prisma } from "@dash/db";
import { normaliseIpAddress } from "../blocked-ips/blocked-ip.schema";
import { PLATFORM_ROOT_DOMAIN } from "../../lib/host-routing";
import type { StoredCartItem } from "../cart/cart.types";
import {
  abandonedCartCheckoutDraftSchema,
  abandonedCartFailureSchema,
  incompleteOrderFailureCodes,
  markAbandonedCartContactedSchema,
  markAbandonedCartRecoveredSchema,
  type AbandonedCartCheckoutDraftInput,
  type AbandonedCartFailureInput
} from "./abandoned-cart.schema";
import {
  countActiveAbandonedCarts,
  countActiveCheckouts,
  deleteActiveAbandonedCart,
  findAbandonedCartByToken,
  findCustomerIdByPhone,
  findIncompleteOrderById,
  findPrimaryStoreDomain,
  getAbandonedCartRecords,
  getIncompleteOrderRecords,
  markAbandonedCartRecovered,
  promoteAbandonedCartStage,
  updateAbandonedCartCheckoutDraft,
  updateAbandonedCartStatus,
  upsertAbandonedCartSnapshot,
  type AbandonedCartListRecord,
  type IncompleteOrderListRecord
} from "./abandoned-cart.repository";
import type {
  AbandonedCartLine,
  AbandonedCartListFilters,
  AbandonedCartRecord,
  AbandonedCartStage,
  AbandonedCartStatus,
  IncompleteOrderDraft,
  IncompleteOrderFailureCode,
  IncompleteOrderRecord
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
 * Keeps what a shopper typed into checkout, as they type it.
 *
 * This is the only point in the funnel where a guest identifies themselves and
 * says where they live, so it runs before the order transaction: a checkout
 * that then fails on stock or payment still leaves the seller someone to call
 * and an address to read back to them.
 */
export async function captureCheckoutDraft(
  storeId: string,
  token: string,
  draft: AbandonedCartCheckoutDraftInput,
  context: CheckoutDraftContext
) {
  await writeCheckoutDraft(storeId, token, draft, context, { attempt: false });
}

/**
 * The same capture, for a Place Order that is about to be tried.
 *
 * Counted apart from typing because the two mean different things on a call:
 * three attempts on one cart is someone who wants to buy and cannot, which is
 * not the same customer as one who wandered off mid-form.
 */
export async function captureCheckoutAttempt(
  storeId: string,
  token: string,
  draft: AbandonedCartCheckoutDraftInput,
  context: CheckoutDraftContext
) {
  await writeCheckoutDraft(storeId, token, draft, context, { attempt: true });
}

/**
 * Records why an attempt did not become an order.
 *
 * Never throws, like everything else here: the shopper is already being shown
 * the real error, and losing the seller-side note about it must not turn into a
 * second failure on top of the first.
 */
export async function recordCheckoutFailure(
  storeId: string,
  token: string,
  failure: AbandonedCartFailureInput
) {
  try {
    const data = abandonedCartFailureSchema.parse(failure);

    await updateAbandonedCartCheckoutDraft(storeId, token, {
      failedAt: new Date(),
      failureCode: data.code,
      failureReason: data.reason ?? null
    });

    // Unconditional: a refusal is the furthest this checkout ever got, and
    // nothing the shopper does afterwards should walk that back.
    await promoteAbandonedCartStage({
      from: ["CART", "CHECKOUT_STARTED"],
      storeId,
      to: "CHECKOUT_FAILED",
      token
    });
  } catch (error) {
    console.error("Failed to record checkout failure", error);
  }
}

/**
 * Where the shopper is asking from, which is not part of the form.
 *
 * Stored canonicalised, the same way an order's is, so a seller looking at a
 * checkout that was refused can see the address it came from and match it
 * against their blocklist without the two spelling it differently.
 */
type CheckoutDraftContext = {
  ipAddress: string | null;
};

async function writeCheckoutDraft(
  storeId: string,
  token: string,
  draft: AbandonedCartCheckoutDraftInput,
  context: CheckoutDraftContext,
  options: { attempt: boolean }
) {
  try {
    const data = abandonedCartCheckoutDraftSchema.parse(draft);
    const customerId = data.phone ? await findCustomerIdByPhone(storeId, data.phone) : null;
    const ipAddress = context.ipAddress ? normaliseIpAddress(context.ipAddress) : null;

    await updateAbandonedCartCheckoutDraft(storeId, token, {
      addressLine1: data.addressLine1 ?? null,
      addressLine2: data.addressLine2 ?? null,
      area: data.area ?? null,
      city: data.city ?? null,
      country: data.country ?? null,
      couponCode: data.couponCode ?? null,
      customerEmail: data.email ?? null,
      customerId,
      customerName: data.name ?? null,
      customerPhone: data.phone ?? null,
      district: data.district ?? null,
      // Typing and pressing Place Order are both activity: neither shopper
      // should age into the abandoned list while they are still on the page.
      lastActivityAt: new Date(),
      paymentMethod: data.paymentMethod ?? null,
      postalCode: data.postalCode ?? null,
      shippingRateId: data.shippingRateId ?? null,
      // Unlike the form fields, an absent address does not overwrite a present
      // one. This capture runs on every keystroke burst, and a single request
      // that arrived without a usable `X-Forwarded-For` says nothing about who
      // is asking — it must not erase what an earlier one already knew.
      ...(ipAddress ? { ipAddress } : {}),
      ...(options.attempt ? { attemptCount: { increment: 1 } } : {})
    });

    // Only ever a promotion out of CART. A cart the shopper has carried into
    // checkout is an incomplete order from here on, and a row that already
    // failed keeps saying so.
    await promoteAbandonedCartStage({
      from: ["CART"],
      storeId,
      to: "CHECKOUT_STARTED",
      token
    });
  } catch (error) {
    console.error("Failed to capture checkout draft", error);
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

/**
 * One incomplete order, ready to be typed into the Create Order form.
 *
 * Returns null rather than throwing for a row that is not there or belongs to
 * another store: the seller followed a link out of a list that may be minutes
 * old, and "this one is gone" is a page state, not an error.
 */
export async function getIncompleteOrderDraft(
  storeId: string,
  cartId: string
): Promise<IncompleteOrderDraft | null> {
  const record = await findIncompleteOrderById(storeId, cartId);

  if (!record) {
    return null;
  }

  return {
    addressLine1: record.addressLine1 ?? "",
    addressLine2: record.addressLine2 ?? "",
    area: record.area ?? "",
    city: record.city ?? "",
    country: record.country ?? "Bangladesh",
    couponCode: record.couponCode,
    customerEmail: record.customerEmail ?? "",
    customerName: record.customerName ?? "",
    customerPhone: record.customerPhone ?? "",
    district: record.district ?? "",
    id: record.id,
    lines: toStoredCartItems(record.items).map((item) => ({
      // The price the shopper was quoted, not today's. They agreed to this
      // number, and the seller ringing them back is confirming that order —
      // every line stays editable if the price has since moved.
      price: Number(item.price).toFixed(2),
      productId: item.productId,
      quantity: item.quantity,
      title: item.variantTitle ? `${item.title} - ${item.variantTitle}` : item.title,
      variantId: item.variantId ?? null
    })),
    notes: record.note ?? "",
    paymentMethod: record.paymentMethod,
    postalCode: record.postalCode ?? "",
    shippingRateId: record.shippingRateId
  };
}

/**
 * Files an incomplete order as recovered once the seller has typed it in.
 *
 * Not gated on the plan and never throws, unlike the seller's own "mark
 * recovered" button: the order exists either way, and a snapshot that stayed on
 * the list after being converted would have the seller ringing a customer who
 * has already bought.
 */
export async function markIncompleteOrderConverted(
  storeId: string,
  cartId: string,
  order: { id: string; orderNumber: string }
) {
  try {
    await updateAbandonedCartStatus(storeId, cartId, {
      recoveredAt: new Date(),
      recoveredOrderId: order.id,
      recoveredOrderNumber: order.orderNumber,
      status: "RECOVERED"
    });
  } catch (error) {
    console.error("Failed to mark incomplete order converted", error);
  }
}

/** Shoppers filling in the checkout form right now, not yet listed as stalled. */
export async function countActiveCheckoutSessions(storeId: string) {
  return countActiveCheckouts(storeId, getAbandonedCartCutoff());
}

export async function listIncompleteOrders(
  store: { currency: string; id: string; slug: string },
  filters: AbandonedCartListFilters = {}
): Promise<IncompleteOrderRecord[]> {
  const [records, origin] = await Promise.all([
    getIncompleteOrderRecords({
      cutoff: getAbandonedCartCutoff(),
      dateRange: filters.dateRange,
      limit: filters.limit,
      search: filters.search,
      storeId: store.id
    }),
    getStorefrontOrigin(store)
  ]);

  return records.map((record) => toIncompleteOrderRecord(record, store.currency, origin));
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

function toIncompleteOrderRecord(
  record: IncompleteOrderListRecord,
  fallbackCurrency: string,
  origin: { href: string; slug: string }
): IncompleteOrderRecord {
  return {
    ...toAbandonedCartRecord(record, fallbackCurrency, origin),
    address: {
      addressLine1: record.addressLine1,
      addressLine2: record.addressLine2,
      area: record.area,
      city: record.city,
      country: record.country,
      district: record.district,
      postalCode: record.postalCode
    },
    attemptCount: record.attemptCount,
    couponCode: record.couponCode,
    failedAt: record.failedAt?.toISOString() ?? null,
    failureCode: toFailureCode(record.failureCode),
    failureReason: record.failureReason,
    ipAddress: record.ipAddress,
    paymentMethod: record.paymentMethod,
    stage: record.stage as AbandonedCartStage
  };
}

/**
 * The column is plain text, so a code written by an older build — or by a
 * branch that shipped a code this one has since dropped — degrades to "Other"
 * rather than rendering as nothing.
 */
function toFailureCode(value: string | null): IncompleteOrderFailureCode | null {
  if (!value) {
    return null;
  }

  return (incompleteOrderFailureCodes as readonly string[]).includes(value)
    ? (value as IncompleteOrderFailureCode)
    : "UNKNOWN";
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
