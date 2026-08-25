import type { Prisma } from "@dash/db";
import { prisma } from "@dash/db";
import {
  getCouponByCodeForStore,
  getCouponRedemptionCountForCustomer,
  type CouponReadClient
} from "./coupon.repository";
import { normaliseCouponCode } from "./coupon.schema";

/**
 * Whether a code may be used, and what it is worth.
 *
 * This module is the only place that answers either question. The preview
 * endpoint and the order transaction both call it, which is what stops the
 * price a shopper is shown from drifting away from the price they are charged —
 * the preview is a courtesy, the transaction is the truth, and neither gets its
 * own copy of the rules.
 */

export type CouponRejectionReason =
  | "ABOVE_MAX_SUBTOTAL"
  | "BELOW_MIN_SUBTOTAL"
  | "CUSTOMER_LIMIT_REACHED"
  | "EXPIRED"
  | "INACTIVE"
  | "NOT_FOUND"
  | "NOT_STARTED"
  | "USAGE_LIMIT_REACHED";

export type CouponEvaluation =
  | {
      /** Money off the subtotal. For FREE_SHIPPING this is the shipping charge. */
      discountAmount: string;
      couponCode: string;
      couponId: string;
      /** True when the discount stands in for the shipping line rather than the goods. */
      freeShipping: boolean;
      ok: true;
    }
  | {
      message: string;
      ok: false;
      reason: CouponRejectionReason;
    };

type EvaluateCouponInput = {
  /** Present only once a shopper has typed one; the per-customer cap is skipped without it. */
  customerPhone?: string | undefined;
  code: string;
  shippingAmount: string | number;
  storeId: string;
  subtotal: string | number;
};

export async function evaluateCoupon(
  input: EvaluateCouponInput,
  client: CouponReadClient = prisma
): Promise<CouponEvaluation> {
  const code = normaliseCouponCode(input.code);

  if (!code) {
    return reject("NOT_FOUND", "Enter a coupon code to apply.");
  }

  const coupon = await getCouponByCodeForStore(input.storeId, code, client);

  if (!coupon) {
    return reject("NOT_FOUND", `${code} is not a valid coupon code.`);
  }

  if (coupon.status !== "ACTIVE") {
    return reject("INACTIVE", `${code} is no longer being accepted.`);
  }

  const now = new Date();

  if (coupon.startsAt && coupon.startsAt > now) {
    return reject("NOT_STARTED", `${code} is not active yet.`);
  }

  if (coupon.expiresAt && coupon.expiresAt < now) {
    return reject("EXPIRED", `${code} has expired.`);
  }

  if (coupon.usageLimitTotal !== null && coupon.usedCount >= coupon.usageLimitTotal) {
    return reject("USAGE_LIMIT_REACHED", `${code} has been fully claimed.`);
  }

  const subtotal = toCents(input.subtotal);

  if (coupon.minSubtotal !== null && subtotal < toCents(coupon.minSubtotal.toString())) {
    return reject(
      "BELOW_MIN_SUBTOTAL",
      `${code} needs an order of at least ${coupon.minSubtotal.toString()}.`
    );
  }

  if (coupon.maxSubtotal !== null && subtotal > toCents(coupon.maxSubtotal.toString())) {
    return reject(
      "ABOVE_MAX_SUBTOTAL",
      `${code} only applies to orders up to ${coupon.maxSubtotal.toString()}.`
    );
  }

  if (coupon.usageLimitPerCustomer !== null && input.customerPhone) {
    const used = await getCouponRedemptionCountForCustomer(coupon.id, input.customerPhone, client);

    if (used >= coupon.usageLimitPerCustomer) {
      return reject("CUSTOMER_LIMIT_REACHED", `You have already used ${code}.`);
    }
  }

  const discount = discountCents(coupon, subtotal, toCents(input.shippingAmount));

  return {
    couponCode: coupon.code,
    couponId: coupon.id,
    discountAmount: fromCents(discount),
    freeShipping: coupon.discountType === "FREE_SHIPPING",
    ok: true
  };
}

/**
 * What the coupon is worth against this cart, in whole cents.
 *
 * Everything is integer arithmetic. `0.1 + 0.2` money is how a total ends up a
 * paisa off the sum of its own lines, and the difference then has to be
 * explained to whoever reconciles the day's orders.
 */
function discountCents(
  coupon: {
    discountType: "FIXED_CART" | "FREE_SHIPPING" | "PERCENTAGE";
    discountValue: Prisma.Decimal;
    maxDiscountAmount: Prisma.Decimal | null;
  },
  subtotalCents: number,
  shippingCents: number
) {
  if (coupon.discountType === "FREE_SHIPPING") {
    return shippingCents;
  }

  if (coupon.discountType === "FIXED_CART") {
    // Never more than the goods are worth — a 500-off code on a 300 cart is a
    // 300 discount, not a 200 refund.
    return Math.min(toCents(coupon.discountValue.toString()), subtotalCents);
  }

  const percent = Number(coupon.discountValue);
  const raw = Math.round((subtotalCents * percent) / 100);
  const capped =
    coupon.maxDiscountAmount === null
      ? raw
      : Math.min(raw, toCents(coupon.maxDiscountAmount.toString()));

  return Math.min(capped, subtotalCents);
}

function reject(reason: CouponRejectionReason, message: string): CouponEvaluation {
  return { message, ok: false, reason };
}

function toCents(value: string | number) {
  return Math.round(Number(value) * 100);
}

function fromCents(cents: number) {
  return (cents / 100).toFixed(2);
}

/**
 * Takes one use of a coupon, or reports that there was none left.
 *
 * The conditional increment is the whole point: checking `usedCount` and then
 * writing it back would let two simultaneous checkouts both pass a "1 use left"
 * cap. Postgres evaluates the comparison and the increment in a single
 * statement, so exactly one of them wins.
 *
 * It also takes a row lock on the coupon for the rest of the transaction, which
 * is what makes the per-customer count read after it trustworthy — concurrent
 * checkouts against the same coupon queue up behind this line.
 */
export async function claimCouponUse(tx: Prisma.TransactionClient, couponId: string, storeId: string) {
  const claimed = await tx.coupon.updateMany({
    where: {
      id: couponId,
      status: "ACTIVE",
      storeId,
      OR: [
        { usageLimitTotal: null },
        { usedCount: { lt: prisma.coupon.fields.usageLimitTotal } }
      ]
    },
    data: {
      usedCount: {
        increment: 1
      }
    }
  });

  return claimed.count === 1;
}
