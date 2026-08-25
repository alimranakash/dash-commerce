import { prisma } from "@dash/db";
import type { Prisma } from "@dash/db";
import {
  captureCheckoutContact,
  resolveCartAfterCheckout
} from "../abandoned-carts/abandoned-cart.service";
import { claimCouponUse, evaluateCoupon } from "../coupons/coupon-validation.service";
import { createCouponRedemption } from "../coupons/coupon.repository";
import { clearCart, getCart, getCartToken } from "../cart/cart.service";
import { assertStoreUnlocked } from "../billing/free-trial";
import { canCreateOrder } from "../billing/subscription-limits";
import { assessOrderSafely } from "../fake-orders/fake-order.assessment";
import {
  getEnabledPaymentMethodForCheckout,
  isManualPaymentType
} from "../payments/payment.service";
import { decrementProductVariantStock, type CartVariantRecord } from "../products/product-variants.service";
import { generateOrderNumber } from "../orders/order-number";
import { getEnabledShippingRateForCheckout } from "../shipping/shipping.service";
import { checkoutSchema, type CheckoutInput } from "./checkout.schema";
import { assertCheckoutPhoneVerified } from "./checkout-verification.service";

type CheckoutStore = {
  currency: string;
  id: string;
  slug: string;
};

export async function createCheckoutOrder(store: CheckoutStore, input: CheckoutInput) {
  const data = checkoutSchema.parse(input);
  const cart = await getCart(store.id);

  if (cart.items.length === 0) {
    throw new Error("Your cart is empty.");
  }

  const cartToken = await getCartToken(store.id);

  // Before anything can fail: a checkout that dies on stock, payment or a
  // closed tab is exactly the cart the seller most needs to be able to chase.
  await captureCheckoutContact(store.id, cartToken, {
    email: data.email,
    name: data.name,
    phone: data.phone
  });

  // A store whose free year ran out stops selling until someone upgrades it.
  // Enforced here rather than on the checkout page so it cannot be bypassed by
  // posting the form directly, and after the contact capture so the seller still
  // keeps the lead they would otherwise lose entirely.
  await assertStoreUnlocked(store.id);

  // After the contact capture, so a checkout blocked by the plan still leaves
  // the seller a recoverable cart, and before any stock is touched.
  if (!(await canCreateOrder(store.id))) {
    throw new Error(
      "This store has reached its monthly order limit and cannot accept new orders right now."
    );
  }

  // Before stock is touched and before the order row exists: a code that does
  // not check out must leave the shopper on the checkout page with their cart
  // intact, not with a half-made order.
  await assertCheckoutPhoneVerified(store.id, {
    code: data.verificationCode,
    paymentMethod: data.paymentMethod,
    phone: data.phone
  });

  const paymentMethod = await getEnabledPaymentMethodForCheckout(store.id, data.paymentMethod);
  const shippingRate = await getEnabledShippingRateForCheckout(store.id, data.shippingRateId);

  if (isManualPaymentType(data.paymentMethod) && !data.paymentReference) {
    throw new Error("Transaction ID or payment reference is required for this payment method.");
  }

  const order = await prisma.$transaction(async (tx) => {
    const productIds = cart.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: {
        id: {
          in: productIds
        },
        storeId: store.id,
        status: "ACTIVE",
        visibility: "PUBLIC"
      },
      select: {
        id: true,
        sku: true,
        stockQuantity: true
      }
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const variantsByLineId = new Map<string, CartVariantRecord>();

    for (const item of cart.items) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new Error(`${item.title} is no longer available.`);
      }

      if (item.variantId) {
        const variant = await decrementProductVariantStock(tx, store.id, item.productId, item.variantId, item.quantity);
        variantsByLineId.set(item.lineId, variant);
        continue;
      }

      if (item.quantity > product.stockQuantity) {
        throw new Error(`${item.title} does not have enough stock.`);
      }
    }

    const customer = await tx.customer.upsert({
      where: {
        storeId_phone: {
          storeId: store.id,
          phone: data.phone
        }
      },
      update: {
        name: data.name,
        ...(data.email ? { email: data.email } : {})
      },
      create: {
        storeId: store.id,
        name: data.name,
        phone: data.phone,
        ...(data.email ? { email: data.email } : {})
      }
    });

    const address = await tx.address.create({
      data: {
        storeId: store.id,
        customerId: customer.id,
        name: data.name,
        phone: data.phone,
        email: data.email ?? null,
        country: data.country,
        district: data.district,
        city: data.city ?? null,
        area: data.area ?? null,
        addressLine1: data.addressLine1,
        addressLine2: data.addressLine2 ?? null,
        postalCode: data.postalCode ?? null
      }
    });

    for (const item of cart.items) {
      if (item.variantId) {
        continue;
      }

      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          storeId: store.id,
          status: "ACTIVE",
          visibility: "PUBLIC",
          stockQuantity: {
            gte: item.quantity
          }
        },
        data: {
          stockQuantity: {
            decrement: item.quantity
          }
        }
      });

      if (updated.count !== 1) {
        throw new Error(`${item.title} does not have enough stock.`);
      }
    }

    const orderNumber = await generateOrderNumber(tx, store.id);
    const subtotalAmount = cart.totals.subtotal;
    const shippingAmount = Number(shippingRate.amount).toFixed(2);
    // Re-evaluated and claimed here, against the subtotal this transaction just
    // computed. Whatever the browser was shown is a quote; this is the price.
    const discount = await claimCheckoutCoupon(tx, {
      code: data.couponCode,
      customerPhone: data.phone,
      shippingAmount,
      storeId: store.id,
      subtotal: subtotalAmount
    });
    const totalAmount = (
      Number(subtotalAmount) +
      Number(shippingAmount) -
      Number(discount.discountAmount)
    ).toFixed(2);

    const created = await tx.order.create({
      data: {
        storeId: store.id,
        customerId: customer.id,
        orderNumber,
        status: "PENDING",
        paymentStatus: "PENDING",
        paymentMethodType: paymentMethod.type,
        paymentMethodName: paymentMethod.name,
        paymentReference: data.paymentReference ?? null,
        paymentNote: data.paymentNote ?? null,
        fulfillmentStatus: "UNFULFILLED",
        currency: store.currency,
        subtotalAmount,
        shippingAmount,
        shippingRateId: shippingRate.id,
        shippingRateName: shippingRate.name,
        shippingDistrict: shippingRate.district ?? data.district,
        shippingCity: shippingRate.city ?? data.city ?? null,
        shippingArea: shippingRate.area ?? data.area ?? null,
        discountAmount: discount.discountAmount,
        couponId: discount.couponId,
        couponCode: discount.couponCode,
        taxAmount: "0.00",
        totalAmount,
        customerName: data.name,
        customerEmail: data.email ?? null,
        customerPhone: data.phone,
        shippingAddressId: address.id,
        billingAddressId: address.id,
        notes: data.notes ?? null,
        items: {
          create: cart.items.map((item) => ({
            productId: item.productId,
            title: item.variantTitle ? `${item.title} - ${item.variantTitle}` : item.title,
            sku: variantsByLineId.get(item.lineId)?.sku ?? productsById.get(item.productId)?.sku ?? null,
            price: item.price,
            quantity: item.quantity,
            total: item.lineTotal,
            imageUrl: item.image
          }))
        }
      }
    });

    // After the order exists, so the ledger row can point at it. Same
    // transaction, so a failure past this line gives the coupon use back.
    if (discount.couponId) {
      await createCouponRedemption(tx, {
        couponId: discount.couponId,
        customerId: customer.id,
        customerPhone: data.phone,
        discountAmount: discount.discountAmount,
        orderId: created.id,
        storeId: store.id
      });
    }

    return created;
  });

  // Settled before the cookie goes: `clearCart` can no longer find the token,
  // and a cart that converted while still active is not a recovery.
  await resolveCartAfterCheckout(store.id, cartToken, order);
  await clearCart(store.id);

  // Outside the transaction and non-throwing: the fraud score is a review aid,
  // so it must never be able to fail a checkout the shopper already completed.
  // An unassessed order is picked up by the dashboard backfill.
  await assessOrderSafely(store.id, order.id);

  return order;
}

type ClaimedCoupon = {
  couponCode: string | null;
  couponId: string | null;
  discountAmount: string;
};

/**
 * Turns the posted code into a discount, and takes the use that pays for it.
 *
 * Runs inside the order transaction so the two cannot come apart: an order that
 * commits has spent exactly one use of the coupon, and an order that rolls back
 * has spent none. A code that has become invalid between the shopper seeing the
 * quote and pressing Place Order throws rather than silently charging them full
 * price — they went to the trouble of entering it, so they get told.
 */
async function claimCheckoutCoupon(
  tx: Prisma.TransactionClient,
  input: {
    code: string | undefined;
    customerPhone: string;
    shippingAmount: string;
    storeId: string;
    subtotal: string;
  }
): Promise<ClaimedCoupon> {
  if (!input.code) {
    return { couponCode: null, couponId: null, discountAmount: "0.00" };
  }

  const evaluation = await evaluateCoupon(
    {
      code: input.code,
      customerPhone: input.customerPhone,
      shippingAmount: input.shippingAmount,
      storeId: input.storeId,
      subtotal: input.subtotal
    },
    tx
  );

  if (!evaluation.ok) {
    throw new Error(evaluation.message);
  }

  // The read above can be stale by the time it lands; this is the check that
  // actually decides, and it is the one that holds the row for the rest of the
  // transaction — including the per-customer count `evaluateCoupon` just did.
  if (!(await claimCouponUse(tx, evaluation.couponId, input.storeId))) {
    throw new Error(`${evaluation.couponCode} has been fully claimed.`);
  }

  return {
    couponCode: evaluation.couponCode,
    couponId: evaluation.couponId,
    discountAmount: evaluation.discountAmount
  };
}
