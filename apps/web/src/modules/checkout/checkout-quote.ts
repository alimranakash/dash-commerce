import type { Cart } from "../cart/cart.types";
import { evaluateCoupon } from "../coupons/coupon-validation.service";
import { priceCartBundles } from "../merchandising/bundle.service";
import { resolveOrderBumpForCheckout } from "../merchandising/order-bump.service";
import {
  checkoutCouponBase,
  checkoutGoodsSubtotal,
  checkoutRedemptionBaseCents
} from "./checkout-pricing";

/**
 * The discounts the checkout page is about to be charged, priced the way
 * `placeCheckoutOrder` prices them: bundles from the cart, the coupon on the
 * cart less the bundle saving, and the points base on the goods after both.
 * A quote and nothing more — no coupon use is claimed and nothing is written —
 * so the order still decides, but on the same definitions this showed.
 *
 * The cart is handed in rather than read here, because only a route has the
 * cookie that says which basket the page is settling.
 */
export async function quoteCheckoutDiscounts(
  storeId: string,
  input: {
    cart: Cart;
    couponCode?: string | undefined;
    customerPhone?: string | undefined;
    orderBumpProductId?: string | undefined;
    /** The selected rate's charge, which is what a free-shipping coupon is worth. */
    shippingAmount: string;
  }
) {
  const bundles = await priceCartBundles(
    storeId,
    input.cart.items.map((item) => ({
      lineId: item.lineId,
      price: item.price,
      productId: item.productId,
      quantity: item.quantity
    }))
  );
  const bump = input.orderBumpProductId
    ? await resolveOrderBumpForCheckout({
        cartProductIds: input.cart.items.map((item) => item.productId),
        productId: input.orderBumpProductId,
        storeId
      })
    : null;
  const couponBase = checkoutCouponBase(input.cart.totals.subtotal, bundles.discountAmount);
  const coupon = input.couponCode
    ? await evaluateCoupon({
        code: input.couponCode,
        ...(input.customerPhone ? { customerPhone: input.customerPhone } : {}),
        shippingAmount: input.shippingAmount,
        storeId,
        subtotal: couponBase
      })
    : null;

  return {
    bundleDiscountAmount: bundles.discountAmount,
    coupon,
    couponBase,
    // A code that will not apply takes nothing off, so it does not shrink what
    // points may cover; the order would refuse it outright anyway.
    redemptionBaseCents: checkoutRedemptionBaseCents({
      bundleDiscountAmount: bundles.discountAmount,
      coupon:
        coupon?.ok === true
          ? { discountAmount: coupon.discountAmount, freeShipping: coupon.freeShipping }
          : { discountAmount: "0.00", freeShipping: false },
      goodsSubtotal: checkoutGoodsSubtotal(
        input.cart.totals.subtotal,
        bump ? bump.offerPrice : null
      )
    })
  };
}
