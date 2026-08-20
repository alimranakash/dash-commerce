import { prisma } from "@dash/db";
import { PLAN_CATALOG } from "./plan-catalog";
import type { PlanInput } from "./admin-plans.schema";

/**
 * Seeds the plan catalog into an empty table only. This deliberately stays a
 * no-op once any plan exists, so it can never revert an admin's edits — a
 * populated database is brought up to date by `scripts/backfill-plans.ts`.
 */
export async function ensureDefaultPlans() {
  const count = await prisma.plan.count();

  if (count > 0) {
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
