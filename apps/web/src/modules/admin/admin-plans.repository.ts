import { prisma } from "@dash/db";
import type { PlanInput } from "./admin-plans.schema";

export async function ensureDefaultPlans() {
  const count = await prisma.plan.count();

  if (count > 0) {
    return;
  }

  await prisma.plan.createMany({
    data: [
      {
        aiEnabled: false,
        currency: "BDT",
        customDomainEnabled: false,
        description: "Start selling with a professional storefront and core commerce tools.",
        isActive: true,
        isFeatured: false,
        name: "Starter",
        orderLimit: 200,
        posEnabled: false,
        priceMonthly: "990.00",
        priceYearly: "9900.00",
        productLimit: 100,
        slug: "starter",
        sortOrder: 1,
        staffLimit: 1,
        storeLimit: 1,
        trialDays: 7
      },
      {
        aiEnabled: true,
        currency: "BDT",
        customDomainEnabled: true,
        description: "Grow with more products, AI insights, and branded storefront controls.",
        isActive: true,
        isFeatured: true,
        name: "Growth",
        orderLimit: 2000,
        posEnabled: false,
        priceMonthly: "2490.00",
        priceYearly: "24900.00",
        productLimit: 1000,
        slug: "growth",
        sortOrder: 2,
        staffLimit: 5,
        storeLimit: 2,
        trialDays: 14
      },
      {
        aiEnabled: true,
        currency: "BDT",
        customDomainEnabled: true,
        description: "Scale operations with higher limits, POS readiness, and premium features.",
        isActive: true,
        isFeatured: false,
        name: "Pro",
        orderLimit: 0,
        posEnabled: true,
        priceMonthly: "4990.00",
        priceYearly: "49900.00",
        productLimit: 0,
        slug: "pro",
        sortOrder: 3,
        staffLimit: 20,
        storeLimit: 5,
        trialDays: 14
      }
    ],
    skipDuplicates: true
  });
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
    staffLimit: data.staffLimit,
    storeLimit: data.storeLimit,
    trialDays: data.trialDays
  };
}
