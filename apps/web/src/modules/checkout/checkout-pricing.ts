import { loyaltyEarningBaseCents } from "../loyalty/loyalty.rules";

/**
 * The three figures a checkout measures discounts against, as pure functions
 * shared by the order transaction and the quotes the checkout page shows.
 *
 * They exist because the page used to work them out differently from the
 * order: the coupon quote was taken on the cart's whole subtotal while the
 * order claimed the coupon on the subtotal less bundle savings, so a cart with
 * a bundle and a percentage coupon was shown one discount and charged another,
 * and the points maximum shown beside it was measured on the wrong one. With
 * one definition of each, a quote and the order it previews cannot disagree.
 */

/**
 * The order's goods: the cart, plus the accepted add-on at its offer price.
 * The cart's own string when there is no add-on, exactly as the order stores it.
 */
export function checkoutGoodsSubtotal(cartSubtotal: string, bumpOfferPrice: string | null) {
  return bumpOfferPrice === null
    ? cartSubtotal
    : (Number(cartSubtotal) + Number(bumpOfferPrice)).toFixed(2);
}

/**
 * What a coupon is measured on: the cart's own subtotal less what bundles
 * already took. Never the add-on, which is already discounted — the same rule
 * that keeps a bundle from taking a second cut off it.
 */
export function checkoutCouponBase(cartSubtotal: string, bundleDiscountAmount: string) {
  return Math.max(0, Number(cartSubtotal) - Number(bundleDiscountAmount)).toFixed(2);
}

/**
 * What points may cover, in cents: the order's goods less the bundle saving
 * and less the coupon — unless the coupon waived delivery, which is not a
 * discount on goods. Shipping is never in it.
 */
export function checkoutRedemptionBaseCents(input: {
  bundleDiscountAmount: string;
  coupon: { discountAmount: string; freeShipping: boolean };
  goodsSubtotal: string;
}) {
  return loyaltyEarningBaseCents({
    bundleDiscountAmount: input.bundleDiscountAmount,
    couponCoversShipping: input.coupon.freeShipping,
    discountAmount: input.coupon.discountAmount,
    subtotalAmount: input.goodsSubtotal
  });
}
