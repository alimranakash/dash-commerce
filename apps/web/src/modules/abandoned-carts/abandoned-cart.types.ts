export type AbandonedCartStatus = "NOT_CONTACTED" | "CONTACTED" | "RECOVERED";

/**
 * How far a snapshot got before it stopped. Mirrors the Prisma enum by hand so
 * this file stays importable from client components without pulling the
 * generated client in behind it.
 */
export type AbandonedCartStage = "CART" | "CHECKOUT_STARTED" | "CHECKOUT_FAILED";

/** Why a submitted checkout did not become an order. */
export type IncompleteOrderFailureCode =
  | "BLOCKED_IP"
  | "COUPON"
  | "EMPTY_CART"
  | "ORDER_LIMIT"
  | "OUT_OF_STOCK"
  | "PAYMENT_REFERENCE"
  | "PHONE_VERIFICATION"
  | "STORE_LOCKED"
  | "UNKNOWN"
  | "VALIDATION";

export type AbandonedCartOutreachChannel = "email" | "manual" | "whatsapp";

/** One line of a snapshotted cart, as shown in the dashboard drawer. */
export type AbandonedCartLine = {
  id: string;
  price: number;
  productName: string;
  quantity: number;
};

export type AbandonedCartRecord = {
  cartValue: number;
  currency: string;
  customerName: string;
  email: string | null;
  id: string;
  items: AbandonedCartLine[];
  lastActivity: string;
  phone: string | null;
  /** Storefront link that restores this exact cart, for manual outreach. */
  recoveryUrl: string;
  status: AbandonedCartStatus;
};

/** The delivery details a shopper typed into checkout but never placed. */
export type IncompleteOrderAddress = {
  addressLine1: string | null;
  addressLine2: string | null;
  area: string | null;
  city: string | null;
  country: string | null;
  district: string | null;
  postalCode: string | null;
};

/**
 * A checkout that was filled in but never became an order.
 *
 * The same snapshot row an abandoned cart is built from, read for the further
 * columns checkout writes onto it — so anything true of a cart is true here too.
 */
export type IncompleteOrderRecord = AbandonedCartRecord & {
  address: IncompleteOrderAddress;
  /** How many times Place Order was pressed on this cart. */
  attemptCount: number;
  couponCode: string | null;
  failedAt: string | null;
  failureCode: IncompleteOrderFailureCode | null;
  /** The sentence the shopper was shown, kept verbatim. */
  failureReason: string | null;
  /** Canonicalised, so it reads the same here as on the blocklist. */
  ipAddress: string | null;
  paymentMethod: string | null;
  stage: AbandonedCartStage;
};

/** One cart line, resolved back to the ids the manual order form works in. */
export type IncompleteOrderDraftLine = {
  price: string;
  productId: string;
  quantity: number;
  title: string;
  variantId: string | null;
};

/**
 * An incomplete order, shaped for the Create Order form.
 *
 * Deliberately all strings and plain ids: it is form input, not an order. None
 * of it has been validated, priced or reserved, and every field stays editable
 * — the seller is on the phone to this customer and half of it may change.
 */
export type IncompleteOrderDraft = {
  addressLine1: string;
  addressLine2: string;
  area: string;
  city: string;
  country: string;
  /** Shown to the seller so they can honour it as a discount; never applied. */
  couponCode: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  district: string;
  id: string;
  lines: IncompleteOrderDraftLine[];
  notes: string;
  paymentMethod: string | null;
  postalCode: string;
  shippingRateId: string | null;
};

export type AbandonedCartListFilters = {
  dateRange?: string | undefined;
  limit?: number | undefined;
  search?: string | undefined;
};
