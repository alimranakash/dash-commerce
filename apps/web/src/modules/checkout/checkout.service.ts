import { prisma } from "@dash/db";
import type { Prisma } from "@dash/db";
import {
  captureCheckoutAttempt,
  findConvertedOrderIdForCart,
  recordCheckoutFailure,
  resolveCartAfterCheckout
} from "../abandoned-carts/abandoned-cart.service";
import type { AbandonedCartCheckoutDraftInput } from "../abandoned-carts/abandoned-cart.schema";
import { CheckoutError, classifyCheckoutFailure } from "./checkout-failure";
import { claimCouponUse, evaluateCoupon } from "../coupons/coupon-validation.service";
import { createCouponRedemption } from "../coupons/coupon.repository";
import { clearCart, getCart, getCartToken } from "../cart/cart.service";
import { parseCartScope, type CartItem, type CartItemSource, type CartScope } from "../cart/cart.types";
import { createOrderBundles, priceCartBundles } from "../merchandising/bundle.service";
import { resolveOrderBumpForCheckout } from "../merchandising/order-bump.service";
import type { OrderBumpOffer } from "../merchandising/order-bump.schema";
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
import { isUniqueConstraintError } from "../../lib/prisma-errors";
import { resolveShippingCharge } from "../free-shipping/free-shipping.render";
import { cartEarnsFreeShipping, getFreeShippingRule } from "../free-shipping/free-shipping.service";
import { getEnabledShippingRateForCheckout } from "../shipping/shipping.service";
import { checkoutSchema, type CheckoutInput } from "./checkout.schema";
import { ensureCheckoutSubmissionSchema } from "./checkout-submission-schema";
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

/**
 * The line id the checkout's own offer travels under.
 *
 * It never came out of the cart, so it needs an id of its own for the two
 * loops that key on one — and it is what marks the order line afterwards.
 */
const ORDER_BUMP_LINE_ID = "order-bump";

/**
 * A cart line, or the offer that is only ever added here.
 *
 * The cart's own source union deliberately excludes ORDER_BUMP — a bump never
 * enters a cart — so this widens it for the one list that holds both.
 */
type CheckoutLine = Omit<CartItem, "source"> & {
  source: CartItemSource | "ORDER_BUMP";
};

type CheckoutStore = {
  currency: string;
  id: string;
  slug: string;
};

/** What the route needs to know to decide whether the side effects should run. */
export type CheckoutOrderResult = {
  order: Awaited<ReturnType<typeof placeCheckoutOrder>>;
  /**
   * True when the order came back rather than being created — the same
   * submission arriving twice, or a cart the seller had already turned into an
   * order. The caller must not re-send the confirmation or re-report the sale.
   */
  replayed: boolean;
};

/**
 * Places an order, and leaves the seller a lead behind when it cannot.
 *
 * Everything that decides whether the order happens is in `placeCheckoutOrder`.
 * This wrapper is the bookkeeping around it, and that is deliberately outside
 * the attempt: the draft is captured before the form is even validated, so a
 * shopper stopped by a typo in their phone number is as recoverable as one
 * stopped by an out-of-stock line, and the reason is filed from the error on
 * the way back out.
 *
 * It is also where one submission is kept to one order. A shopper on a slow
 * connection taps Place Order twice, a dropped response gets retried, a back
 * button re-posts a cached form — all three used to buy the same basket twice,
 * because nothing downstream could tell them apart from a customer who really
 * did want two. The submission key can.
 */
export async function createCheckoutOrder(
  store: CheckoutStore,
  input: CheckoutInput,
  context: CheckoutContext
): Promise<CheckoutOrderResult> {
  await ensureCheckoutSubmissionSchema();

  const submissionId = readSubmissionId(input);
  const placed = submissionId ? await findOrderBySubmission(store.id, submissionId) : null;

  // Already bought. Returned rather than re-created, and flagged so the caller
  // does not send the confirmation SMS or report the purchase a second time.
  if (placed) {
    return { order: placed, replayed: true };
  }

  // Resolved once, here, and threaded through everything below. A Direct
  // Checkout settles its own one-line basket and its own snapshot; the
  // shopper's real cart is neither read, nor billed, nor cleared, and is still
  // waiting for them afterwards.
  const scope = parseCartScope(input.checkoutScope);
  const cartToken = await getCartToken(store.id, scope);
  const convertedOrderId = await findConvertedOrderIdForCart(store.id, cartToken);
  const converted = convertedOrderId ? await findStoreOrder(store.id, convertedOrderId) : null;

  // The seller rang this customer and typed the order in themselves while the
  // shopper still had checkout open. Placing it again would send the same
  // parcel twice and collect for it twice.
  //
  // The cart is cleared rather than left sitting there: it is the only way the
  // shopper gets a fresh token, and without one they would meet this same wall
  // on every future visit. It does mean anything they added after the seller
  // rang goes with it — worth it against a duplicate parcel, and they can add
  // it again and order normally.
  if (converted) {
    await clearCart(store.id, scope);

    return { order: converted, replayed: true };
  }

  await captureCheckoutAttempt(store.id, cartToken, toCheckoutDraft(input), {
    ipAddress: context.ipAddress
  });

  try {
    return {
      order: await placeCheckoutOrder(store, input, context, cartToken, scope),
      replayed: false
    };
  } catch (error) {
    // Two taps close enough together both got past the read above; the unique
    // index is what broke the tie, and the one that lost it is looking at its
    // twin's order, not at a failure.
    if (submissionId && isDuplicateSubmissionError(error)) {
      const winner = await findOrderBySubmission(store.id, submissionId);

      if (winner) {
        return { order: winner, replayed: true };
      }
    }

    // The shopper is already being shown this error; the seller gets the same
    // sentence, filed against the cart it happened to.
    await recordCheckoutFailure(store.id, cartToken, classifyCheckoutFailure(error));

    throw error;
  }
}

function readSubmissionId(input: CheckoutInput) {
  return String(input.submissionId ?? "").trim().slice(0, 64) || null;
}

function findOrderBySubmission(storeId: string, checkoutSubmissionId: string) {
  return prisma.order.findFirst({
    where: {
      checkoutSubmissionId,
      storeId
    }
  });
}

/**
 * Scoped by store, and nullable on purpose: the id comes off a snapshot that
 * can outlive the order it names, and a deleted order must let the checkout
 * through rather than wedge it.
 */
function findStoreOrder(storeId: string, id: string) {
  return prisma.order.findFirst({
    where: {
      id,
      storeId
    }
  });
}

/**
 * A unique violation on the submission index, and nothing else.
 *
 * `checkoutSubmissionId` belongs to `Order` alone, so it stays specific even
 * though `placeCheckoutOrder` writes several models — no other unique in that
 * call could answer to the name.
 */
function isDuplicateSubmissionError(error: unknown) {
  return isUniqueConstraintError(error, "checkoutSubmissionId");
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
  cartToken: string,
  scope: CartScope
) {
  const data = checkoutSchema.parse(input);
  const submissionId = data.submissionId ?? null;
  // Canonicalised once, here, and used for both the block check and the stored
  // column. The blocklist holds canonical addresses, so an order row that spelled
  // the same address differently would split the per-address aggregates the
  // suggestion list is built from and make "already blocked" read false on the
  // review page for an address that is blocked. Unparseable becomes null: a value
  // nothing can match on is worse than no value at all.
  const ipAddress = context.ipAddress ? normaliseIpAddress(context.ipAddress) : null;
  const cart = await getCart(store.id, scope);

  if (cart.items.length === 0) {
    throw new CheckoutError(
      "EMPTY_CART",
      scope === "direct"
        ? "This direct checkout has expired. Please open the product and try again."
        : "Your cart is empty."
    );
  }

  // The tick box posted an id; everything else about the offer — the discount,
  // and therefore the price — is read here from the store's own configuration
  // against the product's live price. The browser cannot name a price.
  //
  // An offer that no longer stands stops the order rather than being dropped
  // from it. The shopper chose the item; shipping them an order quietly missing
  // it is the worse of the two surprises, and their cart survives either way.
  const bump = data.orderBumpProductId
    ? await resolveOrderBumpForCheckout({
        cartProductIds: cart.items.map((item) => item.productId),
        productId: data.orderBumpProductId,
        storeId: store.id
      })
    : null;

  if (data.orderBumpProductId && !bump) {
    throw new CheckoutError(
      "OUT_OF_STOCK",
      "The add-on offer is no longer available. Please review your order and place it again."
    );
  }

  // One list from here down. Once the offer has a server-decided price it is a
  // line like any other, and nothing below has to know where it came from.
  const lines: CheckoutLine[] = bump ? [...cart.items, orderBumpLine(bump)] : cart.items;

  // Priced against the cart alone. The bump is already discounted, and letting
  // a bundle take a second cut off it would discount one item twice — the same
  // rule the coupon follows below, for the same reason.
  const bundles = await priceCartBundles(
    store.id,
    cart.items.map((item) => ({
      lineId: item.lineId,
      price: item.price,
      productId: item.productId,
      quantity: item.quantity
    }))
  );

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
    const productIds = lines.map((item) => item.productId);
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
        allowPreorder: true,
        id: true,
        sku: true,
        stockQuantity: true
      }
    });
    const productsById = new Map(products.map((product) => [product.id, product]));
    const variantsByLineId = new Map<string, CartVariantRecord>();
    // Lines the shopper is waiting on, decided here where the stock on hand is
    // still known — after the decrements it would be too late to tell.
    const preorderLineIds = new Set<string>();

    for (const item of lines) {
      const product = productsById.get(item.productId);

      if (!product) {
        throw new CheckoutError("OUT_OF_STOCK", `${item.title} is no longer available.`);
      }

      if (item.variantId) {
        const variant = await decrementProductVariantStock(tx, store.id, item.productId, item.variantId, item.quantity);

        if (item.quantity > variant.stockQuantity) {
          preorderLineIds.add(item.lineId);
        }

        variantsByLineId.set(item.lineId, variant);
        continue;
      }

      // A product that takes pre-orders is allowed to go under. The shortfall
      // is not an error to correct later: negative stock is the record of what
      // the seller now owes, and the line is marked so the order can say so.
      if (!product.allowPreorder && item.quantity > product.stockQuantity) {
        throw new CheckoutError("OUT_OF_STOCK", `${item.title} does not have enough stock.`);
      }

      if (item.quantity > product.stockQuantity) {
        preorderLineIds.add(item.lineId);
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

    for (const item of lines) {
      if (item.variantId) {
        continue;
      }

      const updated = await tx.product.updateMany({
        where: {
          id: item.productId,
          storeId: store.id,
          status: "ACTIVE",
          visibility: "PUBLIC",
          // A pre-order product has no floor to check against; every other one
          // must still have the units on the shelf when this runs.
          ...(productsById.get(item.productId)?.allowPreorder
            ? {}
            : {
                stockQuantity: {
                  gte: item.quantity
                }
              })
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
    const subtotalAmount = bump
      ? (Number(cart.totals.subtotal) + Number(bump.offerPrice)).toFixed(2)
      : cart.totals.subtotal;
    // The shop's own free-shipping threshold, applied here and nowhere else.
    // This is the line that makes the progress bar in the cart a fact rather
    // than an advert: the bar measures the same cart subtotal against the same
    // stored threshold, so a shopper who reaches it is not charged. Before this,
    // the bar promised free delivery and checkout billed the full rate.
    //
    // The rate is untouched for a shop that has never configured a threshold,
    // so this is safe in front of every checkout.
    const shippingAmount = resolveShippingCharge(await getFreeShippingRule(store.id), {
      // A product the seller flagged earns it outright, whatever the cart comes
      // to; the threshold is the other way in. Both are checked here so the two
      // routes cannot disagree with the bar that advertised them.
      hasFreeShippingProduct: await cartEarnsFreeShipping(
        store.id,
        cart.items.map((item) => item.productId)
      ),
      rateAmount: shippingRate.amount.toString(),
      subtotal: cart.totals.subtotal,
      zoneId: shippingRate.zoneId
    });
    // Re-evaluated and claimed here, against the subtotal this transaction just
    // computed. Whatever the browser was shown is a quote; this is the price.
    //
    // Deliberately the cart's subtotal, minus what the bundles already took:
    // the bump is discounted and the bundle lines are discounted, so a coupon
    // measured against the full figure would be spending money twice. What is
    // left is what the shopper still owes on their own cart, which is the only
    // honest base for "10% off".
    const bundleDiscountAmount = bundles.discountAmount;
    const couponBase = Math.max(
      0,
      Number(cart.totals.subtotal) - Number(bundleDiscountAmount)
    ).toFixed(2);
    const discount = await claimCheckoutCoupon(tx, {
      code: data.couponCode,
      customerPhone: data.phone,
      shippingAmount,
      storeId: store.id,
      subtotal: couponBase
    });
    const totalAmount = (
      Number(subtotalAmount) +
      Number(shippingAmount) -
      Number(discount.discountAmount) -
      Number(bundleDiscountAmount)
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
        bundleDiscountAmount,
        couponId: discount.couponId,
        couponCode: discount.couponCode,
        taxAmount: "0.00",
        totalAmount,
        customerName: data.name,
        customerEmail: data.email ?? null,
        customerPhone: data.phone,
        checkoutSubmissionId: submissionId,
        ipAddress,
        shippingAddressId: address.id,
        billingAddressId: address.id,
        notes: data.notes ?? null,
        items: {
          create: lines.map((item) => ({
            productId: item.productId,
            variantId: item.variantId ?? null,
            isPreorder: preorderLineIds.has(item.lineId),
            source: item.source,
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

    // Same transaction as the order, so an order that rolls back leaves no
    // record of a saving it never gave.
    await createOrderBundles(tx, {
      bundles: bundles.applied.map((entry) => ({
        bundleId: entry.bundleId,
        discountAmount: entry.discountAmount,
        name: entry.name,
        timesApplied: entry.timesApplied
      })),
      orderId: created.id,
      storeId: store.id
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
  await clearCart(store.id, scope);

  // Outside the transaction and non-throwing: the fraud score is a review aid,
  // so it must never be able to fail a checkout the shopper already completed.
  // An unassessed order is picked up by the dashboard backfill.
  await assessOrderSafely(store.id, order.id);

  return order;
}

/**
 * The resolved offer as a cart line.
 *
 * Quantity is fixed at one: the box is a yes-or-no, and a shopper who wants two
 * of something is doing more thinking than this offer is for.
 */
function orderBumpLine(offer: OrderBumpOffer): CheckoutLine {
  return {
    image: offer.imageUrl,
    lineId: ORDER_BUMP_LINE_ID,
    lineTotal: offer.offerPrice,
    price: offer.offerPrice,
    productId: offer.productId,
    quantity: 1,
    sku: null,
    source: "ORDER_BUMP",
    title: offer.title,
    variantId: null,
    variantTitle: null
  };
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
