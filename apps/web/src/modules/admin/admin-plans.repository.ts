import { prisma } from "@dash/db";
import { DEFAULT_PLAN_SLUG, FREE_PLAN_TRIAL_DAYS, PLAN_CATALOG } from "./plan-catalog";
import { singleFlight } from "../../lib/single-flight";
import type { PlanInput } from "./admin-plans.schema";

/**
 * Seeds the plan catalog into an empty table only. Pricing, limits and flags on
 * an existing plan deliberately stay untouched, so this can never revert an
 * admin's edits — those are brought up to date by `scripts/backfill-plans.ts`.
 *
 * Two things are repaired on a populated database, because both are cases where
 * the code and the data disagreeing is always a bug rather than an edit:
 * `repairFreePlanTrialDays()`, and the feature entitlements below.
 *
 * Single-flighted for the reason `ensureDefaultSubscriptionsForStores` is: on an
 * empty table two concurrent callers both read `count === 0` and both seed the
 * catalog, and the loser takes a duplicate `slug` rather than the plans it
 * asked for.
 */
export const ensureDefaultPlans = singleFlight(async () => {
  const count = await prisma.plan.count();

  if (count > 0) {
    await repairFreePlanTrialDays();
    await syncPlanFeatureEntitlements();
    return;
  }

  // Created one at a time rather than with `createMany` so each plan's feature
  // entitlements are written in the same nested call.
  for (const { features, ...plan } of PLAN_CATALOG) {
    await prisma.plan.create({
      data: {
        ...plan,
        features: {
          create: features.map((featureKey) => ({ featureKey }))
        }
      }
    });
  }
});

/**
 * The single value repaired on a populated table.
 *
 * `trialDays: 0` on the free tier is not a setting anyone can have meant: the
 * plan *is* the platform's year-long offer, and a zero stamps every store
 * created afterwards with a trial that has already ended — the "your free year
 * has ended" lock on the day the seller registered. `Plan.trialDays` defaults to
 * `0`, so every database seeded before the free year shipped carries it.
 *
 * Any positive number is left alone, so an admin who shortens the free trial
 * keeps their edit. Existing subscriptions are not touched here; the store-level
 * half of the repair is `scripts/backfill-free-trials.mts`.
 */
async function repairFreePlanTrialDays() {
  await prisma.plan.updateMany({
    data: {
      trialDays: FREE_PLAN_TRIAL_DAYS
    },
    where: {
      slug: DEFAULT_PLAN_SLUG,
      trialDays: {
        lte: 0
      }
    }
  });
}

/**
 * Brings every plan's `plan_features` rows in line with `PLAN_CATALOG`.
 *
 * Entitlements have no admin UI — the catalog in code is their only source of
 * truth — so unlike prices there is nothing here for an admin to have edited,
 * and drift can only mean the database predates the running deploy. Without
 * this, moving a feature between tiers ships as code that silently does nothing
 * until someone remembers to run the backfill against each environment: the
 * seller upgrades, and the pages they just paid for stay marked Paid.
 *
 * Cheap on the common path — one read of a small table, and no writes at all
 * once the two agree. It runs wherever `ensureDefaultPlans()` does, which
 * includes the billing page a seller upgrades from, so a deploy heals itself the
 * first time anyone looks at their plan.
 */
async function syncPlanFeatureEntitlements() {
  const plans = await prisma.plan.findMany({
    select: {
      features: {
        select: {
          featureKey: true
        }
      },
      id: true,
      slug: true
    }
  });
  const bySlug = new Map(plans.map((plan) => [plan.slug, plan]));

  for (const entry of PLAN_CATALOG) {
    const plan = bySlug.get(entry.slug);

    // A plan the catalog names but the database does not have is left alone:
    // creating it here would mean inventing a price.
    if (!plan) {
      continue;
    }

    const current = new Set(plan.features.map((feature) => feature.featureKey));
    const desired = new Set<string>(entry.features);
    const missing = entry.features.filter((key) => !current.has(key));
    const extra = [...current].filter((key) => !desired.has(key));

    if (missing.length > 0) {
      await prisma.planFeature.createMany({
        data: missing.map((featureKey) => ({ featureKey, planId: plan.id })),
        skipDuplicates: true
      });
    }

    // Revoking matters as much as granting: a key that moved up a tier has to
    // stop being granted by the cheaper one.
    if (extra.length > 0) {
      await prisma.planFeature.deleteMany({
        where: {
          featureKey: {
            in: extra
          },
          planId: plan.id
        }
      });
    }
  }
}

export async function getAdminPlans() {
  await ensureDefaultPlans();

  return prisma.plan.findMany({
    orderBy: [
      {
        sortOrder: "asc"
      },
      {
        createdAt: "asc"
      }
    ]
  });
}

export async function getAdminPlanMetrics() {
  await ensureDefaultPlans();

  const [totalPlans, activePlans, featuredPlan, maxTrial] = await Promise.all([
    prisma.plan.count(),
    prisma.plan.count({
      where: {
        isActive: true
      }
    }),
    prisma.plan.findFirst({
      where: {
        isFeatured: true
      },
      orderBy: {
        sortOrder: "asc"
      },
      select: {
        name: true
      }
    }),
    prisma.plan.aggregate({
      _max: {
        trialDays: true
      }
    })
  ]);

  return {
    activePlans,
    featuredPlan: featuredPlan?.name ?? "None",
    freeTrialDays: maxTrial._max.trialDays ?? 0,
    totalPlans
  };
}

export async function findPlanBySlug(slug: string, ignorePlanId?: string) {
  return prisma.plan.findFirst({
    where: {
      slug,
      ...(ignorePlanId ? { id: { not: ignorePlanId } } : {})
    },
    select: {
      id: true
    }
  });
}

export async function createAdminPlan(data: PlanInput) {
  return prisma.plan.create({
    data: formatPlanData(data)
  });
}

export async function updateAdminPlan(planId: string, data: PlanInput) {
  return prisma.plan.update({
    where: {
      id: planId
    },
    data: formatPlanData(data)
  });
}

export async function setAdminPlanActive(planId: string, isActive: boolean) {
  return prisma.plan.update({
    where: {
      id: planId
    },
    data: {
      isActive
    }
  });
}

export async function setAdminPlanFeatured(planId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.plan.updateMany({
      data: {
        isFeatured: false
      }
    });

    return tx.plan.update({
      where: {
        id: planId
      },
      data: {
        isFeatured: true
      }
    });
  });
}

export async function deleteAdminPlan(planId: string) {
  return prisma.plan.delete({
    where: {
      id: planId
    }
  });
}

function formatPlanData(data: PlanInput) {
  return {
    aiEnabled: data.aiEnabled,
    currency: data.currency.toUpperCase(),
    customDomainEnabled: data.customDomainEnabled,
    customerLimit: data.customerLimit,
    description: data.description || null,
    isActive: data.isActive,
    isFeatured: data.isFeatured,
    name: data.name,
    orderLimit: data.orderLimit,
    posEnabled: data.posEnabled,
    priceMonthly: data.priceMonthly.toFixed(2),
    priceYearly: data.priceYearly.toFixed(2),
    productLimit: data.productLimit,
    slug: data.slug,
    sortOrder: data.sortOrder,
    smsLimit: data.smsLimit,
    staffLimit: data.staffLimit,
    storeLimit: data.storeLimit,
    trialDays: data.trialDays
  };
}
