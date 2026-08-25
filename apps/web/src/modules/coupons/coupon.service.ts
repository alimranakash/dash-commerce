import type { Prisma } from "@dash/db";
import {
  couponCodeExistsForStore,
  createCouponRecord,
  deleteCouponRecord,
  getCouponByCodeForStore,
  getCouponByIdForStore,
  getCouponCountsForStore,
  getCouponRedemptionCount,
  getCouponsForStore,
  updateCouponRecord,
  type CouponFilters
} from "./coupon.repository";
import {
  createCouponSchema,
  updateCouponSchema,
  type CouponFormInput,
  type CreateCouponInput,
  type UpdateCouponInput
} from "./coupon.schema";

export {
  getCouponByCodeForStore,
  getCouponByIdForStore,
  getCouponCountsForStore,
  getCouponRedemptionCount,
  getCouponsForStore
};
export type { CouponFilters };

export class CouponError extends Error {
  /** Field the message belongs against, so the form can highlight it. */
  readonly field: string;

  constructor(message: string, field = "form") {
    super(message);
    this.name = "CouponError";
    this.field = field;
  }
}

/** The shape the list and detail views read — never the Prisma row directly. */
export type CouponView = {
  code: string;
  createdAt: Date;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED_CART" | "FREE_SHIPPING";
  discountValue: string;
  expiresAt: Date | null;
  id: string;
  maxDiscountAmount: string | null;
  maxSubtotal: string | null;
  minSubtotal: string | null;
  name: string;
  /** Derived, not stored: what the seller should actually see on the badge. */
  redemptionState: CouponRedemptionState;
  startsAt: Date | null;
  status: "ACTIVE" | "INACTIVE";
  usageLimitPerCustomer: number | null;
  usageLimitTotal: number | null;
  usedCount: number;
};

/**
 * Why a coupon would or would not be accepted right now, ignoring the cart.
 *
 * `status` alone is not the answer a seller wants on a list row — a coupon can
 * be ACTIVE and still be dead because it expired last week or burned through
 * its usage cap. Cart-dependent reasons (subtotal bounds, per-customer caps)
 * are deliberately absent: they are checkout's to decide, and showing them here
 * would mean guessing at a cart that does not exist.
 */
export type CouponRedemptionState = "ACTIVE" | "EXPIRED" | "INACTIVE" | "SCHEDULED" | "USED_UP";

export function deriveCouponRedemptionState(
  coupon: {
    expiresAt: Date | null;
    startsAt: Date | null;
    status: string;
    usageLimitTotal: number | null;
    usedCount: number;
  },
  now = new Date()
): CouponRedemptionState {
  if (coupon.status !== "ACTIVE") {
    return "INACTIVE";
  }

  if (coupon.usageLimitTotal !== null && coupon.usedCount >= coupon.usageLimitTotal) {
    return "USED_UP";
  }

  if (coupon.startsAt && coupon.startsAt > now) {
    return "SCHEDULED";
  }

  if (coupon.expiresAt && coupon.expiresAt < now) {
    return "EXPIRED";
  }

  return "ACTIVE";
}

type CouponRow = Awaited<ReturnType<typeof getCouponByIdForStore>>;

export function toCouponView(coupon: NonNullable<CouponRow>): CouponView {
  return {
    code: coupon.code,
    createdAt: coupon.createdAt,
    description: coupon.description,
    discountType: coupon.discountType,
    discountValue: coupon.discountValue.toString(),
    expiresAt: coupon.expiresAt,
    id: coupon.id,
    maxDiscountAmount: coupon.maxDiscountAmount?.toString() ?? null,
    maxSubtotal: coupon.maxSubtotal?.toString() ?? null,
    minSubtotal: coupon.minSubtotal?.toString() ?? null,
    name: coupon.name,
    redemptionState: deriveCouponRedemptionState(coupon),
    startsAt: coupon.startsAt,
    status: coupon.status,
    usageLimitPerCustomer: coupon.usageLimitPerCustomer,
    usageLimitTotal: coupon.usageLimitTotal,
    usedCount: coupon.usedCount
  };
}

export async function listCoupons(storeId: string, filters: CouponFilters = {}) {
  const coupons = await getCouponsForStore(storeId, filters);

  return coupons.map(toCouponView);
}

export async function findCoupon(storeId: string, couponId: string) {
  const coupon = await getCouponByIdForStore(storeId, couponId);

  return coupon ? toCouponView(coupon) : null;
}

export async function createCoupon(storeId: string, input: CouponFormInput) {
  const data = createCouponSchema.parse(input);

  if (await couponCodeExistsForStore(storeId, data.code)) {
    throw new CouponError(`The code ${data.code} is already used by another coupon.`, "code");
  }

  return createCouponRecord({
    storeId,
    ...couponWriteData(data)
  });
}

export async function updateCoupon(storeId: string, couponId: string, input: CouponFormInput) {
  const data = updateCouponSchema.parse(input);
  const existing = await getCouponByIdForStore(storeId, couponId);

  if (!existing) {
    return null;
  }

  if (await couponCodeExistsForStore(storeId, data.code, couponId)) {
    throw new CouponError(`The code ${data.code} is already used by another coupon.`, "code");
  }

  return updateCouponRecord(storeId, couponId, couponWriteData(data));
}

/**
 * Deleting a coupon that has been used would take its redemptions with it
 * (`onDelete: Cascade`), and those rows are what a past order's discount is
 * explained by. Sellers who want to stop a live code want INACTIVE, which this
 * says out loud rather than silently doing on their behalf.
 */
export async function deleteCoupon(storeId: string, couponId: string) {
  const existing = await getCouponByIdForStore(storeId, couponId);

  if (!existing) {
    return null;
  }

  const redemptions = await getCouponRedemptionCount(couponId);

  if (redemptions > 0) {
    throw new CouponError(
      `${existing.code} has been used ${redemptions} ${redemptions === 1 ? "time" : "times"} and cannot be deleted. Set it to Inactive to stop accepting it.`
    );
  }

  await deleteCouponRecord(storeId, couponId);

  return existing;
}

export async function setCouponStatus(
  storeId: string,
  couponId: string,
  status: "ACTIVE" | "INACTIVE"
) {
  return updateCouponRecord(storeId, couponId, { status });
}

/**
 * Maps validated input onto columns.
 *
 * Every optional field is written as an explicit `null` rather than omitted:
 * this same object is used for updates, where leaving a key out would mean
 * "keep the old value" and quietly make cleared fields un-clearable.
 */
function couponWriteData(
  data: CreateCouponInput | UpdateCouponInput
): Omit<Prisma.CouponUncheckedCreateInput, "storeId"> {
  return {
    code: data.code,
    description: data.description ?? null,
    discountType: data.discountType,
    // FREE_SHIPPING takes the shipping line, never a subtotal amount. Storing
    // whatever was left in the amount box would make the row lie about itself.
    discountValue: data.discountType === "FREE_SHIPPING" ? "0" : data.discountValue,
    expiresAt: data.expiresAt ? endOfDay(data.expiresAt) : null,
    maxDiscountAmount: data.discountType === "PERCENTAGE" ? (data.maxDiscountAmount ?? null) : null,
    maxSubtotal: data.maxSubtotal ?? null,
    minSubtotal: data.minSubtotal ?? null,
    name: data.name,
    startsAt: data.startsAt ? startOfDay(data.startsAt) : null,
    status: data.status,
    usageLimitPerCustomer: data.usageLimitPerCustomer ?? null,
    usageLimitTotal: data.usageLimitTotal ?? null
  };
}

function startOfDay(isoDate: string) {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** "Valid until the 30th" means through the 30th, not up to its first second. */
function endOfDay(isoDate: string) {
  return new Date(`${isoDate}T23:59:59.999Z`);
}
