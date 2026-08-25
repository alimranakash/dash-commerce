import { prisma } from "@dash/db";
import type { Prisma } from "@dash/db";
import {
  captureCheckoutAttempt,
  recordCheckoutFailure,
  resolveCartAfterCheckout
} from "../abandoned-carts/abandoned-cart.service";
import type { AbandonedCartCheckoutDraftInput } from "../abandoned-carts/abandoned-cart.schema";
import { CheckoutError, classifyCheckoutFailure } from "./checkout-failure";
import { claimCouponUse, evaluateCoupon } from "../coupons/coupon-validation.service";
import { createCouponRedemption } from "../coupons/coupon.repository";
import { clearCart, getCart, getCartToken } from "../cart/cart.service";
import { assertStoreUnlocked } from "../billing/free-trial";
import { assertIpNotBlocked } from "../blocked-ips/blocked-ip.enforcement";
import { normaliseIpAddress } from "../blocked-ips/blocked-ip.schema";
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

/**
 * Request-scoped facts about the shopper that are not part of the form.
 *
 * Passed in rather than read here because the headers only exist on the route:
 * a service that reached for them would stop working the moment anything but
 * an HTTP request called it.
 */
type CheckoutContext = {
  ipAddress: string | null;
};

type CheckoutStore = {
  currency: string;
  id: string;
  slug: string;
};

/**
 * Places an order, and leaves the seller a lead behind when it cannot.
 *
 * Everything that decides whether the order happens is in `placeCheckoutOrder`.
 * This wrapper is only the bookkeeping around it, and that is deliberately
 * outside the attempt: the draft is captured before the form is even validated,
 * so a shopper stopped by a typo in their phone number is as recoverable as one
 * stopped by an out-of-stock line, and the reason is filed from the error on
 * the way back out.
 */
export async function createCheckoutOrder(
  store: CheckoutStore,
  input: CheckoutInput,
  context: CheckoutContext
) {
  const cartToken = await getCartToken(store.id);

  await captureCheckoutAttempt(store.id, cartToken, toCheckoutDraft(input), {
    ipAddress: context.ipAddress
  });

  try {
    return await placeCheckoutOrder(store, input, context, cartToken);
  } catch (error) {
    // The shopper is already being shown this error; the seller gets the same
    // sentence, filed against the cart it happened to.
    await recordCheckoutFailure(store.id, cartToken, classifyCheckoutFailure(error));

    throw error;
  }
}

/**
 * The posted form as it stands, for the snapshot.
 *
 * Reads `input` rather than the parsed `data` on purpose — a form that fails
 * `checkoutSchema` is exactly the one worth keeping, and the draft schema caps
 * every field rather than rejecting it.
 */
function toCheckoutDraft(input: CheckoutInput): AbandonedCartCheckoutDraftInput {
  return {
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2,
    area: input.area,
    city: input.city,
    country: input.country,
    couponCode: input.couponCode,
    district: input.district,
    email: input.email,
    name: input.name,
    paymentMethod: input.paymentMethod,
    phone: input.phone,
    postalCode: input.postalCode,
    shippingRateId: input.shippingRateId
  };
}

async function placeCheckoutOrder(
  store: CheckoutStore,
  input: CheckoutInput,
  context: CheckoutContext,
  cartToken: string
) {
  const data = checkoutSchema.parse(input);
  // Canonicalised once, here, and used for both the block check and the stored
  // column. The blocklist holds canonical addresses, so an order row that spelled
  // the same address differently would split the per-address aggregates the
  // suggestion list is built from and make "already blocked" read false on the
  // review page for an address that is blocked. Unparseable becomes null: a value
  // nothing can match on is worse than no value at all.
  const ipAddress = context.ipAddress ? normaliseIpAddress(context.ipAddress) : null;
  const cart = await getCart(store.id);

  if (cart.items.length === 0) {
    throw new CheckoutError("EMPTY_CART", "Your cart is empty.");
  }

  // First of the checks, and cheap on purpose: a blocked address should cost
  // the store nothing, not a plan-limit read and certainly not an SMS. Order
  // placement is the only thing the blocklist stops — browsing the storefront
  // is unaffected. The lead was captured by the caller before any of this ran,
  // so a shopper stopped here is still one the seller can see and ring.
  await assertIpNotBlocked(store.id, ipAddress);

  // A store whose free year ran out stops selling until someone upgrades it.
  // Enforced here rather than on the checkout page so it cannot be bypassed by
  // posting the form directly.
  await assertStoreUnlocked(store.id);

  // Before any stock is touched.
  if (!(await canCreateOrder(store.id))) {
    throw new CheckoutError(
      "ORDER_LIMIT",
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
    throw new CheckoutError(
      "PAYMENT_REFERENCE",
      "Transaction ID or payment reference is required for this payment method."
    );
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
        throw new CheckoutError("OUT_OF_STOCK", `${item.title} is no longer available.`);
      }

      if (item.variantId) {
        const variant = await decrementProductVariantStock(tx, store.id, item.productId, item.variantId, item.quantity);
        variantsByLineId.set(item.lineId, variant);
        continue;
      }

      if (item.quantity > product.stockQuantity) {
        throw new CheckoutError("OUT_OF_STOCK", `${item.title} does not have enough stock.`);
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
        throw new CheckoutError("OUT_OF_STOCK", `${item.title} does not have enough stock.`);
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
        ipAddress,
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
    throw new CheckoutError("COUPON", evaluation.message);
  }

  // The read above can be stale by the time it lands; this is the check that
  // actually decides, and it is the one that holds the row for the rest of the
  // transaction — including the per-customer count `evaluateCoupon` just did.
  if (!(await claimCouponUse(tx, evaluation.couponId, input.storeId))) {
    throw new CheckoutError("COUPON", `${evaluation.couponCode} has been fully claimed.`);
  }

  return {
    couponCode: evaluation.couponCode,
    couponId: evaluation.couponId,
    discountAmount: evaluation.discountAmount
  };
}
