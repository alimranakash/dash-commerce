import { prisma } from "@dash/db";
import { PLAN_FEATURE_REGISTRY, isPlanFeatureKey, type PlanFeatureKey } from "./plan-features";

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
    staffLimit: subscription.plan.staffLimit,
    storeLimit: subscription.plan.storeLimit,
    subscriptionStatus: subscription.status
  };
}

export async function canCreateProduct(storeId: string) {
  const limits = await getPlanLimits(storeId);

  if (!limits || limits.productLimit <= 0) {
    return true;
  }

  const productCount = await prisma.product.count({
    where: {
      storeId
    }
  });

  return productCount < limits.productLimit;
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
