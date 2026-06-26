import { prisma } from "@dash/db";

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
