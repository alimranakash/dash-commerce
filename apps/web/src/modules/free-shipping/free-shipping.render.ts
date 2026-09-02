/**
 * Free shipping: the threshold, the progress bar, and the one rule that decides
 * both.
 *
 * This module exists because the bar that shipped before it was a lie. The cart
 * and the mini cart rendered "Just ৳120 away from free shipping" from a
 * *display* setting — `cartPage.freeShippingAmount`, on by default at 250 —
 * while `createCheckoutOrder` charged `shippingRate.amount` unconditionally.
 * Nothing in the codebase waived a delivery charge on a subtotal. A shopper who
 * did what the bar asked was charged anyway, and found out on the last screen.
 *
 * So the rule here is the same one the notification bar's countdown follows:
 * **the promise and the price come from one number.** `resolveShippingCharge`
 * is what checkout charges, `freeShippingProgress` is what the bar shows, and
 * both read the same `FreeShippingRule`. There is no second copy of the
 * threshold to drift, and a shop with no rule configured renders no bar at all
 * rather than a bar that means nothing.
 *
 * Pure and database-free on purpose: the storefront bar runs it in the browser,
 * the dashboard preview runs it as the seller types, checkout runs it on the
 * server, and `npm run verify:free-shipping` drives every branch of it without
 * a database.
 */

export type FreeShippingRule = {
  enabled: boolean;
  /**
   * Which shipping zones the offer covers. Empty means every zone.
   *
   * Worth its own field on a Bangladesh-oriented product: Inside Dhaka is 70 BDT
   * and Outside Dhaka is 130, and a shop that can afford to absorb the first
   * very often cannot absorb the second. Without this the only honest options
   * would be giving away both or neither.
   */
  zoneIds: string[];
  /** The qualifying cart subtotal. Always above zero — see the schema. */
  threshold: number;
};

/**
 * Money as whole cents.
 *
 * Comparisons are made on integers rather than on the parsed decimals, because
 * `12.1 + 0.2 >= 12.3` is false in binary floating point and this comparison
 * decides whether a shopper is charged for delivery. A shopper one hundredth of
 * a taka short through rounding is a support ticket.
 */
function toCents(value: number | string) {
  const amount = typeof value === "string" ? Number(value) : value;

  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

/**
 * Whether the offer exists at all.
 *
 * Only the seller's switch. The threshold is *not* part of this any more: a shop
 * can run free shipping purely off flagged products — "buy this jacket, delivery
 * is on us" — with no order value in it at all, and that is a complete
 * configuration rather than a half-finished one.
 */
export function isFreeShippingLive(rule: FreeShippingRule) {
  return rule.enabled;
}

/** What a cart brings to the question, beyond its own total. */
export type FreeShippingCart = {
  /**
   * Whether any line in the cart is a product the seller flagged as earning
   * free delivery.
   *
   * The whole order stops being charged, not that line: this shop bills one flat
   * rate per order, so there is no per-item delivery to waive and no honest way
   * to split it. That is also why the flag is worth reserving for products that
   * can carry it, which is what the product form says.
   */
  hasFreeShippingProduct?: boolean | undefined;
  subtotal: number | string;
  zoneId?: string | null | undefined;
};

/**
 * Whether this cart, going to this zone, has earned free delivery.
 *
 * Two ways to qualify and one geography. A flagged product earns it outright; an
 * order value earns it once the threshold is set and met. The zone check comes
 * first and applies to both, because a shop that cannot absorb 130 taka to
 * Chattogram cannot absorb it for one product either — one offer, two routes in.
 *
 * The subtotal is the *cart* subtotal — the number the shopper watches go up and
 * the number the progress bar measures against. Deliberately not the
 * post-bundle-discount figure the coupon is measured on: a bar that counts one
 * thing while checkout counts another is the bug this module exists to remove,
 * and of the two only one is ever on screen.
 */
export function qualifiesForFreeShipping(rule: FreeShippingRule, input: FreeShippingCart) {
  if (!isFreeShippingLive(rule)) {
    return false;
  }

  // An empty zone list is "everywhere", so a rule keeps working when a seller
  // adds a zone later rather than silently excluding it.
  if (rule.zoneIds.length > 0 && (!input.zoneId || !rule.zoneIds.includes(input.zoneId))) {
    return false;
  }

  if (input.hasFreeShippingProduct) {
    return true;
  }

  // No threshold means the seller is running the product route only, so an
  // ordinary cart earns nothing however large it is.
  return rule.threshold > 0 && toCents(input.subtotal) >= toCents(rule.threshold);
}

/**
 * What checkout charges for delivery — the authority, and the whole point.
 *
 * Returns a fixed-2 string because that is what `Order.shippingAmount` stores
 * and what every total downstream adds up. A rule that does not apply returns
 * the rate untouched, so this is safe to put in front of every checkout whether
 * or not the shop has ever configured free shipping.
 */
export function resolveShippingCharge(
  rule: FreeShippingRule,
  input: FreeShippingCart & { rateAmount: number | string }
) {
  if (qualifiesForFreeShipping(rule, input)) {
    return "0.00";
  }

  return (toCents(input.rateAmount) / 100).toFixed(2);
}

export type FreeShippingProgress = {
  /** 0–100, for the track's width. */
  percent: number;
  qualifies: boolean;
  /** What is still needed. Zero once qualified. */
  remaining: number;
  threshold: number;
};

/**
 * How far this cart is from the offer, or null when there is no offer.
 *
 * Null rather than a zeroed object: the caller renders **nothing** for a shop
 * that has not configured free shipping, instead of an empty progress track
 * that implies an offer exists. `zoneId` is optional because the cart does not
 * know where the shopper lives yet — the bar shows the shop's offer, and
 * checkout, which does know, makes the final call through
 * `resolveShippingCharge`.
 */
export function freeShippingProgress(
  rule: FreeShippingRule,
  subtotal: number | string,
  cart: { hasFreeShippingProduct?: boolean | undefined } = {}
): FreeShippingProgress | null {
  if (!isFreeShippingLive(rule)) {
    return null;
  }

  // Already earned by something in the basket, so there is no distance left to
  // show. A full track and the earned sentence, whatever the subtotal — asking
  // a shopper to keep spending towards something they already have is the other
  // way this widget can lie.
  if (cart.hasFreeShippingProduct) {
    return { percent: 100, qualifies: true, remaining: 0, threshold: rule.threshold };
  }

  // No threshold and nothing flagged in the cart: the seller is running the
  // product route only, and there is no progress to draw towards it.
  if (rule.threshold <= 0) {
    return null;
  }

  const subtotalCents = Math.max(0, toCents(subtotal));
  const thresholdCents = toCents(rule.threshold);
  const remainingCents = Math.max(0, thresholdCents - subtotalCents);

  return {
    percent: Math.max(0, Math.min(100, (subtotalCents / thresholdCents) * 100)),
    qualifies: remainingCents === 0,
    remaining: remainingCents / 100,
    threshold: thresholdCents / 100
  };
}

/**
 * The seller's sentence with the shortfall in it.
 *
 * `{amount}` is the only placeholder, and an absent one is not an error: a
 * seller who writes "Spend a little more for free delivery" gets exactly that.
 * The amount arrives already formatted in the shop's own currency, because the
 * formatter needs a locale this pure module has no business knowing.
 */
export function formatFreeShippingMessage(template: string, formattedRemaining: string) {
  const text = template.trim();

  if (text === "") {
    return `${formattedRemaining} away from free shipping.`;
  }

  return text.replaceAll("{amount}", formattedRemaining);
}
