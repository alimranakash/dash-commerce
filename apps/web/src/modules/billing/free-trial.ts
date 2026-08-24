import { prisma } from "@dash/db";
import { DEFAULT_PLAN_SLUG } from "../admin/plan-catalog";

/**
 * What a store's free year looks like right now.
 *
 * `null` from every reader below means "this store is not on a counted-down free
 * plan" — it pays for a plan, has no subscription row, or predates the free year
 * and has no trial end date. None of those are locked, and none of them show a
 * countdown.
 */
export type FreeTrialState = {
  /** Whole days left, rounded up, floored at zero. The dashboard shows only this. */
  daysRemaining: number;
  endsAt: Date;
  /** True once the year is up: the dashboard locks and the storefront stops selling. */
  isExpired: boolean;
  /** Length of the granted trial, for the progress bar. Null when it cannot be derived. */
  totalDays: number | null;
};

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * The free tier is a year-long trial, not a permanently free plan: `trialEndsAt`
 * is stamped when the store is created (`createDefaultSubscriptionRecord`) and
 * everything about the offer — the countdown, the lock, the storefront block —
 * is derived from that one date rather than stored as a second piece of state.
 *
 * Deliberately scoped to the free plan. A paid plan that lapses is the manual
 * payment flow's problem and keeps the behaviour it already had; this is only
 * the free year running out.
 */
export async function getStoreFreeTrialState(storeId: string): Promise<FreeTrialState | null> {
  const subscription = await prisma.subscription.findUnique({
    select: {
      plan: {
        select: {
          slug: true
        }
      },
      trialEndsAt: true,
      trialStartsAt: true
    },
    where: {
      storeId
    }
  });

  if (!subscription?.trialEndsAt || subscription.plan.slug !== DEFAULT_PLAN_SLUG) {
    return null;
  }

  // A trial that ends the moment it starts was never a year. It is what a store
  // created against a `trialDays: 0` free plan row was stamped with — every
  // database seeded before the free year shipped had one — and reading it as an
  // elapsed trial locks a seller out on the day they registered. Treat a
  // non-positive window as "no trial was granted" and fail open, the same way a
  // subscription with no trial end date at all does.
  if (subscription.trialStartsAt && subscription.trialEndsAt <= subscription.trialStartsAt) {
    return null;
  }

  return {
    daysRemaining: daysUntil(subscription.trialEndsAt),
    endsAt: subscription.trialEndsAt,
    isExpired: subscription.trialEndsAt.getTime() <= Date.now(),
    totalDays: subscription.trialStartsAt
      ? Math.max(
          1,
          Math.round(
            (subscription.trialEndsAt.getTime() - subscription.trialStartsAt.getTime()) / DAY_MS
          )
        )
      : null
  };
}

/**
 * Whether the store has run out its free year and has not upgraded.
 *
 * Fails **open** on a missing subscription, matching `canCreateOrder` and
 * `canCreateProduct`: a storefront must not stop selling because its billing row
 * is absent. Only a free plan with an elapsed `trialEndsAt` locks.
 */
export async function isStoreLocked(storeId: string) {
  return (await getStoreFreeTrialState(storeId))?.isExpired === true;
}

/**
 * Thrown by `assertStoreUnlocked`. Carries a message written for the person who
 * sees it — a shopper at checkout, not the seller — so it can be surfaced
 * verbatim by the storefront.
 */
export class SubscriptionLockedError extends Error {
  constructor(message = "This store is not accepting orders right now. Please try again later.") {
    super(message);
    this.name = "SubscriptionLockedError";
  }
}

/** Guard form, for write paths that must stop at an expired free year. */
export async function assertStoreUnlocked(storeId: string) {
  if (await isStoreLocked(storeId)) {
    throw new SubscriptionLockedError();
  }
}

/** Whole days from now until `date`, rounded up and floored at zero. */
export function daysUntil(date: Date) {
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / DAY_MS));
}
