import { prisma, type Prisma } from "@dash/db";
import { ensureDefaultPlans } from "./admin-plans.repository";
import { DEFAULT_PLAN_SLUG, FALLBACK_DEFAULT_PLAN_SLUG } from "./plan-catalog";
import { BILLING_CYCLE_DAYS } from "./admin-subscriptions.schema";

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
  const trialEndsAt = addDays(now, defaultPlan.trialDays);

  return tx.subscription.upsert({
    create: {
      billingCycle: "MONTHLY",
      currentPeriodEndsAt: trialEndsAt,
      currentPeriodStartsAt: now,
      organizationId: input.organizationId,
      planId: defaultPlan.id,
      status: "TRIALING",
      storeId: input.storeId,
      trialEndsAt,
      trialStartsAt: now
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

export async function ensureDefaultSubscriptionsForStores() {
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

  await prisma.$transaction(async (tx) => {
    for (const store of missingStores) {
      await createDefaultSubscriptionRecord(tx, {
        organizationId: store.organizationId,
        storeId: store.id
      });
    }
  });
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
