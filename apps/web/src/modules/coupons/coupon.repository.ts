import { prisma } from "@dash/db";
import type { Prisma, PrismaClient } from "@dash/db";
import type { CouponStatus } from "./coupon.schema";

/**
 * Enough of the client for the reads checkout makes.
 *
 * The lookups used while an order is being built have to run on the enclosing
 * transaction, or they would read committed state and miss the row lock the
 * usage claim is holding — the point of taking that lock in the first place.
 */
export type CouponReadClient = Pick<PrismaClient, "coupon" | "couponRedemption"> | Prisma.TransactionClient;

export type CouponFilters = {
  from?: Date | undefined;
  search?: string | undefined;
  status?: CouponStatus | undefined;
  to?: Date | undefined;
};

/**
 * Every query in this file starts from `storeId`. A coupon is a promise about
 * one store's prices, so a lookup that could ever match another store's row is
 * a bug regardless of what the caller does with the result.
 */
function couponWhere(storeId: string, filters: CouponFilters = {}): Prisma.CouponWhereInput {
  const search = filters.search?.trim();

  return {
    storeId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.from || filters.to
      ? {
          createdAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {})
          }
        }
      : {}),
    ...(search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" } },
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  };
}

export async function getCouponsForStore(storeId: string, filters: CouponFilters = {}) {
  return prisma.coupon.findMany({
    where: couponWhere(storeId, filters),
    orderBy: {
      createdAt: "desc"
    }
  });
}

/**
 * Tab counts for the list header.
 *
 * The search and date filters are applied but the status filter deliberately is
 * not — the badge on "Inactive" has to keep showing how many inactive coupons
 * match the search while the seller is standing on the "Active" tab.
 */
export async function getCouponCountsForStore(storeId: string, filters: CouponFilters = {}) {
  const scoped: CouponFilters = {
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    ...(filters.to ? { to: filters.to } : {})
  };

  const [all, active, inactive] = await Promise.all([
    prisma.coupon.count({ where: couponWhere(storeId, scoped) }),
    prisma.coupon.count({ where: couponWhere(storeId, { ...scoped, status: "ACTIVE" }) }),
    prisma.coupon.count({ where: couponWhere(storeId, { ...scoped, status: "INACTIVE" }) })
  ]);

  return { active, all, inactive };
}

export async function getCouponByIdForStore(storeId: string, couponId: string) {
  return prisma.coupon.findFirst({
    where: {
      id: couponId,
      storeId
    }
  });
}

/** `code` is expected pre-normalised by `normaliseCouponCode`. */
export async function getCouponByCodeForStore(
  storeId: string,
  code: string,
  client: CouponReadClient = prisma
) {
  return client.coupon.findFirst({
    where: {
      code,
      storeId
    }
  });
}

/**
 * Uniqueness probe for the service layer. `excludeCouponId` lets an edit keep
 * its own code without reporting a clash with itself.
 */
export async function couponCodeExistsForStore(
  storeId: string,
  code: string,
  excludeCouponId?: string
) {
  const existing = await prisma.coupon.findFirst({
    where: {
      code,
      storeId,
      ...(excludeCouponId ? { id: { not: excludeCouponId } } : {})
    },
    select: {
      id: true
    }
  });

  return existing !== null;
}

export async function createCouponRecord(data: Prisma.CouponUncheckedCreateInput) {
  return prisma.coupon.create({ data });
}

export async function updateCouponRecord(
  storeId: string,
  couponId: string,
  data: Prisma.CouponUncheckedUpdateInput
) {
  // `updateMany` rather than `update`: it takes the store scope in its own
  // where-clause, so there is no window between checking ownership and writing.
  const result = await prisma.coupon.updateMany({
    where: {
      id: couponId,
      storeId
    },
    data
  });

  if (result.count === 0) {
    return null;
  }

  return getCouponByIdForStore(storeId, couponId);
}

export async function deleteCouponRecord(storeId: string, couponId: string) {
  return prisma.coupon.deleteMany({
    where: {
      id: couponId,
      storeId
    }
  });
}

export async function getCouponRedemptionCount(couponId: string) {
  return prisma.couponRedemption.count({
    where: {
      couponId
    }
  });
}

/** How many times one phone number has already used a given coupon. */
export async function getCouponRedemptionCountForCustomer(
  couponId: string,
  customerPhone: string,
  client: CouponReadClient = prisma
) {
  return client.couponRedemption.count({
    where: {
      couponId,
      customerPhone
    }
  });
}

export async function createCouponRedemption(
  tx: Prisma.TransactionClient,
  data: Prisma.CouponRedemptionUncheckedCreateInput
) {
  return tx.couponRedemption.create({ data });
}
