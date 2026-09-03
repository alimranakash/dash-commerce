import { formatStorefrontMoney } from "../storefront/format";
import {
  GUEST_ORDER_WINDOW_DAYS,
  guestOrderExpiresAt,
  type GuestOrderRef
} from "./guest-orders.cookie";

type Money = number | string | { toString(): string };

export type GuestOrderItemRow = {
  id: string;
  imageUrl: string | null;
  isPreorder: boolean;
  quantity: number;
  title: string;
  total: Money;
};

export type GuestOrderAddressRow = {
  addressLine1: string;
  addressLine2: string | null;
  area: string | null;
  city: string | null;
  country: string;
  district: string;
  postalCode: string | null;
};

export type GuestOrderRow = {
  bundleDiscountAmount: Money;
  createdAt: Date | string;
  currency: string;
  customerEmail: string | null;
  customerName: string;
  customerPhone: string;
  discountAmount: Money;
  fulfillmentStatus: string;
  id: string;
  items: GuestOrderItemRow[];
  orderNumber: string;
  paymentMethodName: string;
  paymentStatus: string;
  shippingAddress: GuestOrderAddressRow | null;
  shippingAmount: Money;
  shippingArea: string | null;
  shippingCity: string | null;
  shippingDistrict: string | null;
  shippingRateName: string | null;
  status: string;
  subtotalAmount: Money;
  taxAmount: Money;
  totalAmount: Money;
};

export type GuestOrderLineView = {
  id: string;
  imageUrl: string | null;
  isPreorder: boolean;
  quantity: number;
  title: string;
  total: string;
};

export type GuestOrderView = {
  discount: string | null;
  expiryLabel: string;
  fulfillmentLabel: string;
  id: string;
  lines: GuestOrderLineView[];
  orderNumber: string;
  paymentLabel: string;
  paymentStatusLabel: string;
  placedAtLabel: string;
  shipping: string;
  shippingLabel: string;
  statusLabel: string;
  subtotal: string;
  tax: string | null;
  total: string;
};

export type GuestAccountView = {
  address: string[];
  orders: GuestOrderView[];
  profile: {
    email: string | null;
    name: string;
    phone: string;
  };
  windowDays: number;
};

/**
 * What a shopper is told their order is doing.
 *
 * The shop's own words, not the enum's: `order.status.toLowerCase()` puts
 * "pending" on a screen where the shopper cannot tell whether that means the
 * shop has seen it. Anything unrecognised falls back to the raw value rather
 * than to a guess, so a status added later reads oddly instead of wrongly.
 */
export function guestOrderStatusLabel(status: string) {
  return ORDER_STATUS_LABELS[status] ?? humanize(status);
}

export function guestPaymentStatusLabel(status: string) {
  return PAYMENT_STATUS_LABELS[status] ?? humanize(status);
}

export function guestFulfillmentLabel(status: string) {
  return FULFILLMENT_LABELS[status] ?? humanize(status);
}

/**
 * When this receipt leaves the device, in the shopper's own terms.
 *
 * Said out loud on the card because the alternative is a page that silently
 * empties: a shopper who looked at their order every evening and finds nothing
 * on the fourth has no way to tell "it was forgotten, as promised" from "the
 * shop lost my order".
 */
export function guestOrderExpiryLabel(expiresAt: number, now: number) {
  const remaining = expiresAt - now;

  if (remaining <= 0) {
    return "Clearing from this device now";
  }

  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));

  if (days >= 1) {
    return `Kept on this device for ${days} more ${days === 1 ? "day" : "days"}`;
  }

  const hours = Math.floor(remaining / (60 * 60 * 1000));

  if (hours >= 1) {
    return `Kept on this device for ${hours} more ${hours === 1 ? "hour" : "hours"}`;
  }

  return "Clearing from this device within the hour";
}

/**
 * One order, as its own buyer sees it.
 *
 * Every field is named and formatted here rather than in the component, so the
 * page cannot render a number the checks never drove — and so a widened `select`
 * upstream still cannot put a risk score on a customer's screen.
 */
export function buildGuestOrderView(
  order: GuestOrderRow,
  expiresAt: number,
  now: number
): GuestOrderView {
  const currency = order.currency;
  // The two discounts are kept apart on the order and added up here, because a
  // shopper reading a receipt wants one "you saved" line while the seller's
  // reporting wants both halves. Absent rather than a formatted zero.
  const discount = amount(order.discountAmount) + amount(order.bundleDiscountAmount);
  const tax = amount(order.taxAmount);

  return {
    discount: discount > 0 ? formatStorefrontMoney(discount, currency) : null,
    expiryLabel: guestOrderExpiryLabel(expiresAt, now),
    fulfillmentLabel: guestFulfillmentLabel(order.fulfillmentStatus),
    id: order.id,
    lines: order.items.map((item) => ({
      id: item.id,
      imageUrl: item.imageUrl,
      isPreorder: item.isPreorder,
      quantity: item.quantity,
      title: item.title,
      total: formatStorefrontMoney(item.total, currency)
    })),
    orderNumber: order.orderNumber,
    paymentLabel: order.paymentMethodName,
    paymentStatusLabel: guestPaymentStatusLabel(order.paymentStatus),
    placedAtLabel: formatOrderDate(order.createdAt),
    shipping: formatStorefrontMoney(order.shippingAmount, currency),
    shippingLabel: order.shippingRateName ?? "Manual delivery",
    statusLabel: guestOrderStatusLabel(order.status),
    subtotal: formatStorefrontMoney(order.subtotalAmount, currency),
    tax: tax > 0 ? formatStorefrontMoney(tax, currency) : null,
    total: formatStorefrontMoney(order.totalAmount, currency)
  };
}

/**
 * The whole account page, or nothing at all.
 *
 * Nothing at all is the common case and the important one: a visitor who has
 * never ordered here gets the page exactly as it was, with no hint that anyone
 * else's purchases could ever appear on it.
 *
 * The profile and the address come from the **most recent** order rather than
 * from a merged best-of: these are the details the shopper last typed into
 * checkout, and a page that mixed a new phone number with an old street would be
 * showing an address the shop was never given.
 */
export function buildGuestAccountView(
  orders: readonly GuestOrderRow[],
  refs: readonly GuestOrderRef[],
  now: number
): GuestAccountView | null {
  const expiryById = new Map(refs.map((ref) => [ref.id, guestOrderExpiresAt(ref)]));
  const sorted = [...orders].sort((first, second) => placedAt(second) - placedAt(first));
  const latest = sorted[0];

  if (!latest) {
    return null;
  }

  return {
    address: addressLines(latest),
    orders: sorted.map((order) =>
      buildGuestOrderView(order, expiryById.get(order.id) ?? placedAt(order), now)
    ),
    profile: {
      email: latest.customerEmail,
      name: latest.customerName,
      phone: latest.customerPhone
    },
    windowDays: GUEST_ORDER_WINDOW_DAYS
  };
}

/**
 * Where the parcel was going.
 *
 * The `Address` row is preferred and the order's own shipping columns are the
 * fallback, because an order placed before an address row existed — or one whose
 * address the seller later deleted — still knows the district it shipped to, and
 * a card that renders an empty box is worse than one that renders less.
 */
function addressLines(order: GuestOrderRow) {
  const address = order.shippingAddress;
  const lines = address
    ? [
        address.addressLine1,
        address.addressLine2,
        joinParts([address.area, address.city, address.district]),
        joinParts([address.postalCode, address.country])
      ]
    : [joinParts([order.shippingArea, order.shippingCity, order.shippingDistrict])];

  return lines.filter((line): line is string => Boolean(line && line.trim()));
}

function joinParts(parts: readonly (string | null | undefined)[]) {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(", ");
}

function placedAt(order: GuestOrderRow) {
  const date = new Date(order.createdAt);

  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function formatOrderDate(value: Date | string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(date);
}

function amount(value: Money) {
  const parsed = Number(typeof value === "object" ? value.toString() : value);

  return Number.isFinite(parsed) ? parsed : 0;
}

function humanize(value: string) {
  const text = value.replace(/_/g, " ").toLowerCase().trim();

  return text ? `${text.charAt(0).toUpperCase()}${text.slice(1)}` : "";
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  CONFIRMED: "Confirmed",
  PENDING: "Order placed",
  PROCESSING: "Being prepared"
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  CANCELLED: "Payment cancelled",
  FAILED: "Payment failed",
  PAID: "Paid",
  PENDING: "Payment pending",
  REFUNDED: "Refunded"
};

const FULFILLMENT_LABELS: Record<string, string> = {
  FULFILLED: "Delivered",
  PARTIALLY_FULFILLED: "Partly shipped",
  RETURNED: "Returned",
  SHIPPED: "Shipped",
  UNFULFILLED: "Not shipped yet"
};
