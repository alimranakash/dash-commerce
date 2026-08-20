import { prisma, type Prisma } from "@dash/db";
import { countStoreSmsSentSince } from "../notifications/notifications.repository";
import { countOrganizationMembers, countPendingStaffInvites } from "../staff/staff.repository";
import type { StaffSeatUsage } from "../staff/staff.schema";
import { PLAN_FEATURE_REGISTRY, isPlanFeatureKey, type PlanFeatureKey } from "./plan-features";

/**
 * Anything that can read a subscription and count what it caps: the global
 * `prisma` for ordinary reads, or a transaction client for a caller that must
 * see rows written earlier in its own transaction — store onboarding creates the
 * subscription and seeds the demo catalog inside one, and invite acceptance
 * re-checks the seat count after claiming the invite.
 */
type LimitClient = Prisma.TransactionClient | typeof prisma;

/**
 * Subscription states that carry entitlements. PAST_DUE is deliberately absent:
 * the manual-payment flow parks a subscription there until an admin verifies the
 * transaction, so granting on PAST_DUE would hand out paid features to anyone
 * who submits an unverified reference.
 */
const ENTITLED_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(["ACTIVE", "TRIALING"]);

export async function getCurrentSubscription(storeId: string) {
  return prisma.subscription.findUnique({
    include: {
      plan: true
    },
    where: {
      storeId
    }
  });
}

export async function getPlanLimits(storeId: string) {
  const subscription = await getCurrentSubscription(storeId);

  if (!subscription) {
    return null;
  }

  return {
    aiEnabled: subscription.plan.aiEnabled,
    customDomainEnabled: subscription.plan.customDomainEnabled,
    orderLimit: subscription.plan.orderLimit,
    productLimit: subscription.plan.productLimit,
    smsLimit: subscription.plan.smsLimit,
    staffLimit: subscription.plan.staffLimit,
    storeLimit: subscription.plan.storeLimit,
    subscriptionStatus: subscription.status
  };
}

/**
 * How many more products the store's plan allows, or `null` when nothing caps
 * it — an unlimited plan, or a store with no subscription row, which stays
 * fail-open exactly as `canCreateProduct` always has.
 *
 * Callers that write several products at once (the demo-pack seeder) take the
 * number and spend it down; callers adding one product just ask whether it is
 * zero.
 */
export async function getRemainingProductAllowance(storeId: string, client: LimitClient = prisma) {
  const subscription = await client.subscription.findUnique({
    select: {
      plan: {
        select: {
          productLimit: true
        }
      }
    },
    where: {
      storeId
    }
  });

  if (!subscription || subscription.plan.productLimit <= 0) {
    return null;
  }

  const productCount = await client.product.count({
    where: {
      storeId
    }
  });

  return Math.max(0, subscription.plan.productLimit - productCount);
}

export async function canCreateProduct(storeId: string) {
  return (await getRemainingProductAllowance(storeId)) !== 0;
}

/**
 * First instant of the current calendar month, in the server's local timezone —
 * the same boundary `analytics.repository.ts` and `report.service.ts` use for
 * "this month", so the billing usage bar cannot disagree with the dashboard.
 */
export function startOfCurrentMonth(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/**
 * Orders placed by this store since the month began. `orderLimit` is a monthly
 * allowance rather than a lifetime cap — the pricing cards say "N orders /
 * month" — so every count against it goes through here.
 */
export async function countOrdersThisMonth(storeId: string) {
  return prisma.order.count({
    where: {
      createdAt: {
        gte: startOfCurrentMonth()
      },
      storeId
    }
  });
}

export type SmsAllowance = {
  /** Null when nothing caps it — an unlimited plan, or no subscription row. */
  limit: number | null;
  remaining: number | null;
  used: number;
};

/**
 * How many messages the store's plan still allows this month.
 *
 * Fails open, like the product and order limits: a store with no subscription
 * row is not cut off from sending. Only successful sends are counted, so a
 * month of gateway outages does not eat an allowance nobody got the benefit of.
 */
export async function getSmsAllowance(storeId: string): Promise<SmsAllowance> {
  const limits = await getPlanLimits(storeId);
  const limit = !limits || limits.smsLimit <= 0 ? null : limits.smsLimit;
  const used = await countStoreSmsSentSince(storeId, startOfCurrentMonth());

  return {
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    used
  };
}

/**
 * Whether the store may accept one more order this month. Mirrors
 * `canCreateProduct`, including its fail-open behaviour on a missing
 * subscription: a storefront must not stop selling because its billing row is
 * absent.
 */
export async function canCreateOrder(storeId: string) {
  const limits = await getPlanLimits(storeId);

  if (!limits || limits.orderLimit <= 0) {
    return true;
  }

  return (await countOrdersThisMonth(storeId)) < limits.orderLimit;
}

/**
 * Seats the organization's plan grants and how many are spoken for.
 *
 * Three things about this differ from the product and order limits above, each
 * on purpose:
 *
 * - It is scoped by **organization**, not store. Members hang off the
 *   organization, so the allowance they are counted against has to be read the
 *   same way. `Subscription` carries both ids; today an organization has exactly
 *   one store so the two agree, but the counting unit should not depend on that.
 * - It **fails closed** when there is no subscription row, where
 *   `canCreateProduct` fails open. A storefront must not stop selling because
 *   billing is missing; adding a teammate can wait, and no revenue is lost by
 *   making the seller sort their plan out first.
 * - **Pending invites count against the allowance.** Counting only members would
 *   let a two-seat store send ten invites and end up with ten members, since
 *   each acceptance would look like the first.
 *
 * `limit: null` means unlimited — the `0 = unlimited` convention shared with
 * every other plan limit, resolved here so no caller repeats it.
 */
export async function getStaffSeatUsage(
  organizationId: string,
  client: LimitClient = prisma
): Promise<StaffSeatUsage> {
  const now = new Date();
  const [subscription, members, pendingInvites] = await Promise.all([
    client.subscription.findFirst({
      // An organization has one store, and therefore one subscription, today.
      // Ordering makes the read deterministic if that ever stops being true.
      orderBy: {
        createdAt: "asc"
      },
      select: {
        plan: {
          select: {
            staffLimit: true
          }
        }
      },
      where: {
        organizationId
      }
    }),
    countOrganizationMembers(organizationId, client),
    countPendingStaffInvites(organizationId, client, now)
  ]);
  const used = members + pendingInvites;

  if (!subscription) {
    return {
      limit: 0,
      members,
      pendingInvites,
      remaining: 0,
      used
    };
  }

  const staffLimit = subscription.plan.staffLimit;

  if (staffLimit <= 0) {
    return {
      limit: null,
      members,
      pendingInvites,
      remaining: null,
      used
    };
  }

  return {
    limit: staffLimit,
    members,
    pendingInvites,
    remaining: Math.max(0, staffLimit - used),
    used
  };
}

/** Whether one more seat can be spent — on an invite now, or its acceptance later. */
export async function canAddStaffSeat(organizationId: string, client: LimitClient = prisma) {
  const seats = await getStaffSeatUsage(organizationId, client);

  return seats.remaining === null || seats.remaining > 0;
}

export async function canUseAI(storeId: string) {
  const limits = await getPlanLimits(storeId);
  return Boolean(limits?.aiEnabled);
}

export async function canUseCustomDomain(storeId: string) {
  const limits = await getPlanLimits(storeId);
  return Boolean(limits?.customDomainEnabled);
}

/**
 * Thrown by `requirePlanFeature`. Carries the key so a caller can render its own
 * upgrade prompt instead of parsing the message.
 */
export class PlanFeatureError extends Error {
  readonly featureKey: PlanFeatureKey;

  constructor(featureKey: PlanFeatureKey) {
    super(
      `${PLAN_FEATURE_REGISTRY[featureKey].label} is not included in your current plan. Upgrade from Billing to enable it.`
    );
    this.featureKey = featureKey;
    this.name = "PlanFeatureError";
  }
}

/**
 * Whether a subscription is in a state that grants entitlements. Fails closed:
 * anything past its current period, or in a status outside
 * `ENTITLED_SUBSCRIPTION_STATUSES`, grants nothing.
 *
 * Exported so the verification script can exercise the states directly without
 * writing fixture subscriptions.
 */
export function isEntitledSubscription(subscription: {
  currentPeriodEndsAt: Date | null;
  status: string;
}) {
  if (!ENTITLED_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    return false;
  }

  return !(
    subscription.currentPeriodEndsAt && subscription.currentPeriodEndsAt.getTime() < Date.now()
  );
}

/**
 * The single feature gate. Fails closed on every uncertain path: no store, no
 * subscription, a subscription that is cancelled/expired/past due, or a plan
 * that simply does not grant the key.
 *
 * Note this is stricter than `canCreateProduct` / `canUseCustomDomain`, which
 * predate it and keep their original fail-open-on-missing-subscription
 * behaviour. That difference is intentional and left alone.
 */
export async function hasPlanFeature(storeId: string, featureKey: PlanFeatureKey) {
  const subscription = await prisma.subscription.findUnique({
    select: {
      currentPeriodEndsAt: true,
      plan: {
        select: {
          features: {
            select: {
              id: true
            },
            take: 1,
            where: {
              featureKey
            }
          }
        }
      },
      status: true
    },
    where: {
      storeId
    }
  });

  if (!subscription || !isEntitledSubscription(subscription)) {
    return false;
  }

  return subscription.plan.features.length > 0;
}

/**
 * Guard form of `hasPlanFeature`, for service-layer use so every write path to a
 * gated capability goes through one check — the pattern
 * `assertPlanAllowsCustomDomain` already established in `domains.service.ts`.
 */
export async function requirePlanFeature(storeId: string, featureKey: PlanFeatureKey) {
  if (!(await hasPlanFeature(storeId, featureKey))) {
    throw new PlanFeatureError(featureKey);
  }
}

/**
 * Every feature key the store is currently entitled to. Returns an empty list
 * rather than throwing when the subscription is missing or not entitled, so
 * callers can render capability lists without special-casing. Unknown keys —
 * rows from a different deploy — are dropped.
 */
export async function listPlanFeatures(storeId: string): Promise<PlanFeatureKey[]> {
  const subscription = await prisma.subscription.findUnique({
    select: {
      currentPeriodEndsAt: true,
      plan: {
        select: {
          features: {
            select: {
              featureKey: true
            }
          }
        }
      },
      status: true
    },
    where: {
      storeId
    }
  });

  if (!subscription || !isEntitledSubscription(subscription)) {
    return [];
  }

  return subscription.plan.features
    .map((feature) => feature.featureKey)
    .filter(isPlanFeatureKey)
    .sort();
}
