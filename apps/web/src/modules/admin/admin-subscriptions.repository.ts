import { prisma, type Prisma } from "@dash/db";
import { ensureDefaultPlans } from "./admin-plans.repository";
import { DEFAULT_PLAN_SLUG, FALLBACK_DEFAULT_PLAN_SLUG, newStoreTrialDays } from "./plan-catalog";
import { BILLING_CYCLE_DAYS } from "./admin-subscriptions.schema";
import { isUniqueConstraintError } from "../../lib/prisma-errors";
import { singleFlight } from "../../lib/single-flight";

export type AdminSubscriptionStatusFilter = "all" | "active" | "cancelled" | "expired" | "past_due" | "trialing";
export type AdminSubscriptionBillingFilter = "all" | "monthly" | "yearly";
export type SubscriptionTransaction = Prisma.TransactionClient;

export async function createDefaultSubscriptionRecord(
  tx: SubscriptionTransaction,
  input: {
    organizationId: string;
    storeId: string;
  }
) {
  const existingSubscription = await tx.subscription.findUnique({
    where: {
      storeId: input.storeId
    },
    select: {
      id: true
    }
  });

  if (existingSubscription) {
    return existingSubscription;
  }

  const defaultPlan = await findDefaultPlan(tx);

  if (!defaultPlan) {
    return null;
  }

  const now = new Date();
  const trialDays = newStoreTrialDays(defaultPlan);
  // A plan with no trial gets no trial *dates*, rather than dates equal to `now`.
  // A `trialEndsAt` that has already passed is exactly what the free-year lock
  // reads as expired, and a `currentPeriodEndsAt` in the past costs the store its
  // entitlements — both on the day the seller registered.
  const trialEndsAt = trialDays > 0 ? addDays(now, trialDays) : null;

  return tx.subscription.upsert({
    create: {
      billingCycle: "MONTHLY",
      currentPeriodEndsAt: trialEndsAt ?? addDays(now, BILLING_CYCLE_DAYS.MONTHLY),
      currentPeriodStartsAt: now,
      organizationId: input.organizationId,
      planId: defaultPlan.id,
      status: trialEndsAt ? "TRIALING" : "ACTIVE",
      storeId: input.storeId,
      trialEndsAt,
      trialStartsAt: trialEndsAt ? now : null
    },
    update: {},
    where: {
      storeId: input.storeId
    },
    select: {
      id: true
    }
  });
}

/**
 * Resolves the plan a brand-new store subscribes to. New stores start on the
 * free tier; `starter` — the previous default — is kept as a fallback so a
 * database that predates the free plan still produces a subscription rather than
 * silently leaving the store without one.
 */
async function findDefaultPlan(tx: SubscriptionTransaction) {
  const plans = await tx.plan.findMany({
    where: {
      slug: {
        in: [DEFAULT_PLAN_SLUG, FALLBACK_DEFAULT_PLAN_SLUG]
      }
    },
    select: {
      id: true,
      slug: true,
      trialDays: true
    }
  });

  return (
    plans.find((plan) => plan.slug === DEFAULT_PLAN_SLUG) ??
    plans.find((plan) => plan.slug === FALLBACK_DEFAULT_PLAN_SLUG) ??
    null
  );
}

/**
 * Hands every non-archived store the default subscription it is missing.
 *
 * Single-flighted because it is read-repair reached from several callers at
 * once — `/admin/subscriptions` runs it twice in one `Promise.all` — and two
 * concurrent scans find the same gap and then race to fill it.
 */
export const ensureDefaultSubscriptionsForStores = singleFlight(async () => {
  await ensureDefaultPlans();

  const stores = await prisma.store.findMany({
    where: {
      status: {
        not: "ARCHIVED"
      }
    },
    select: {
      id: true,
      organizationId: true,
      subscription: {
        select: {
          id: true
        }
      }
    }
  });

  const missingStores = stores.filter((store) => !store.subscription);

  if (missingStores.length === 0) {
    return;
  }

  // One store at a time and no shared transaction. Each subscription is a
  // single independent row, so there is nothing here for a transaction to make
  // atomic — while a duplicate raised inside one aborts that transaction for
  // every *other* store too, so a store some concurrent caller happened to seed
  // first would cost the rest of them theirs.
  for (const store of missingStores) {
    try {
      await createDefaultSubscriptionRecord(prisma, {
        organizationId: store.organizationId,
        storeId: store.id
      });
    } catch (error) {
      // Lost the race to a concurrent caller. The row exists, which is the only
      // thing this function was asked for.
      if (!isDuplicateSubscriptionError(error)) {
        throw error;
      }
    }
  }
});

/**
 * A unique violation on `Subscription.storeId` — the store already has the
 * subscription the caller was about to create. Safe to read as narrowly as
 * that only because every caller wraps a write to `Subscription` alone.
 */
export function isDuplicateSubscriptionError(error: unknown) {
  return isUniqueConstraintError(error, "storeId");
}

export async function getAdminSubscriptionMetrics() {
  await ensureDefaultSubscriptionsForStores();

  const [totalSubscriptions, trialing, active, pastDue, cancelled] = await Promise.all([
    prisma.subscription.count(),
    prisma.subscription.count({
      where: {
        status: "TRIALING"
      }
    }),
    prisma.subscription.count({
      where: {
        status: "ACTIVE"
      }
    }),
    prisma.subscription.count({
      where: {
        status: "PAST_DUE"
      }
    }),
    prisma.subscription.count({
      where: {
        status: "CANCELLED"
      }
    })
  ]);

  return {
    active,
    cancelled,
    pastDue,
    totalSubscriptions,
    trialing
  };
}

export async function getAdminSubscriptionPlans() {
  await ensureDefaultPlans();

  return prisma.plan.findMany({
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        name: "asc"
      }
    ],
    select: {
      id: true,
      name: true
    }
  });
}

export async function getAdminSubscriptions(filters: {
  billingCycle?: AdminSubscriptionBillingFilter;
  planId?: string;
  search?: string;
  status?: AdminSubscriptionStatusFilter;
}) {
  await ensureDefaultSubscriptionsForStores();

  const search = filters.search?.trim();
  const where: Prisma.SubscriptionWhereInput = {};
  const status = statusFilter(filters.status);
  const billingCycle = billingCycleFilter(filters.billingCycle);

  if (status) {
    where.status = status;
  }

  if (billingCycle) {
    where.billingCycle = billingCycle;
  }

  if (filters.planId && filters.planId !== "all") {
    where.planId = filters.planId;
  }

  if (search) {
    where.OR = [
      {
        store: {
          name: {
            contains: search,
            mode: "insensitive"
          }
        }
      },
      {
        store: {
          slug: {
            contains: search,
            mode: "insensitive"
          }
        }
      },
      {
        plan: {
          name: {
            contains: search,
            mode: "insensitive"
          }
        }
      },
      {
        organization: {
          members: {
            some: {
              user: {
                email: {
                  contains: search,
                  mode: "insensitive"
                }
              }
            }
          }
        }
      }
    ];
  }

  return prisma.subscription.findMany({
    where,
    include: {
      _count: {
        select: {
          payments: true
        }
      },
      organization: {
        include: {
          members: {
            include: {
              user: {
                select: {
                  email: true,
                  image: true,
                  name: true
                }
              }
            },
            orderBy: {
              createdAt: "asc"
            }
          }
        }
      },
      plan: true,
      store: {
        include: {
          domains: {
            orderBy: [
              {
                isPrimary: "desc"
              },
              {
                createdAt: "asc"
              }
            ],
            take: 1
          }
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

function periodEndFor(startsAt: Date, billingCycle: "MONTHLY" | "YEARLY") {
  return addDays(startsAt, BILLING_CYCLE_DAYS[billingCycle]);
}

/**
 * Assigning a plan also opens its billing period, starting from the date the
 * admin chose (defaulting to now). Without this the plan change has no visible
 * effect on a subscription whose period already lapsed — every entitlement check
 * reads a stale `currentPeriodEndsAt` as expired.
 */
export async function updateAdminSubscriptionPlan(
  subscriptionId: string,
  input: { billingCycle: "MONTHLY" | "YEARLY"; planId: string; startsAt?: Date | undefined }
) {
  const currentPeriodStartsAt = input.startsAt ?? new Date();

  return prisma.subscription.update({
    where: {
      id: subscriptionId
    },
    data: {
      billingCycle: input.billingCycle,
      currentPeriodEndsAt: periodEndFor(currentPeriodStartsAt, input.billingCycle),
      currentPeriodStartsAt,
      planId: input.planId
    }
  });
}

/**
 * Fresh billing period, but only when the current one has already lapsed — so
 * re-activating mid-period never silently hands out extra paid time.
 */
async function periodRefreshIfLapsed(subscriptionId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: {
      id: subscriptionId
    },
    select: {
      billingCycle: true,
      currentPeriodEndsAt: true
    }
  });

  if (!subscription) {
    return {};
  }

  const now = new Date();

  if (subscription.currentPeriodEndsAt && subscription.currentPeriodEndsAt > now) {
    return {};
  }

  return {
    currentPeriodEndsAt: periodEndFor(now, subscription.billingCycle),
    currentPeriodStartsAt: now
  };
}

export async function updateAdminSubscriptionSmsLimit(
  subscriptionId: string,
  smsLimitOverride: number | null
) {
  return prisma.subscription.update({
    data: {
      smsLimitOverride
    },
    where: {
      id: subscriptionId
    }
  });
}

export async function extendAdminSubscriptionTrial(subscriptionId: string, days: number) {
  const subscription = await prisma.subscription.findUnique({
    where: {
      id: subscriptionId
    },
    select: {
      trialEndsAt: true
    }
  });

  if (!subscription) {
    throw new Error("Subscription could not be found.");
  }

  const baseDate = subscription.trialEndsAt && subscription.trialEndsAt > new Date() ? subscription.trialEndsAt : new Date();
  const trialEndsAt = addDays(baseDate, days);

  const data: Prisma.SubscriptionUpdateInput = {
    cancelAtPeriodEnd: false,
    cancelledAt: null,
    currentPeriodEndsAt: trialEndsAt,
    status: "TRIALING",
    trialEndsAt
  };

  if (!subscription.trialEndsAt) {
    data.trialStartsAt = new Date();
  }

  return prisma.subscription.update({
    where: {
      id: subscriptionId
    },
    data
  });
}

/**
 * The store behind a subscription, read before deleting it so the caller can
 * name the store in its log entry once the row itself is gone.
 */
export async function findAdminSubscriptionStore(subscriptionId: string) {
  return prisma.subscription.findUnique({
    where: {
      id: subscriptionId
    },
    select: {
      id: true,
      organizationId: true,
      store: {
        select: {
          id: true,
          name: true,
          status: true
        }
      }
    }
  });
}

/**
 * Removes one subscription outright. Its `Payment` rows cascade with it, so the
 * store's billing history goes too — which is why the admin UI names the payment
 * count before asking to confirm.
 *
 * This never leaves a live store unbilled: `ensureDefaultSubscriptionsForStores`
 * hands any non-archived store a fresh default subscription on the next admin
 * read, so only an archived store stays without one.
 */
export async function deleteAdminSubscription(subscriptionId: string) {
  return prisma.subscription.delete({
    where: {
      id: subscriptionId
    }
  });
}

export async function updateAdminSubscriptionStatus(
  subscriptionId: string,
  status: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | "TRIALING"
) {
  const now = new Date();

  return prisma.subscription.update({
    where: {
      id: subscriptionId
    },
    data: {
      cancelAtPeriodEnd: status === "CANCELLED",
      cancelledAt: status === "CANCELLED" ? now : null,
      status,
      // "ACTIVE but already past currentPeriodEndsAt" is an incoherent state that
      // every entitlement check reads as expired, so activating opens a period.
      ...(status === "ACTIVE" ? await periodRefreshIfLapsed(subscriptionId) : {})
    }
  });
}

function statusFilter(status: AdminSubscriptionStatusFilter | undefined) {
  if (!status || status === "all") {
    return undefined;
  }

  return status.toUpperCase() as "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | "TRIALING";
}

function billingCycleFilter(billingCycle: AdminSubscriptionBillingFilter | undefined) {
  if (!billingCycle || billingCycle === "all") {
    return undefined;
  }

  return billingCycle.toUpperCase() as "MONTHLY" | "YEARLY";
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
