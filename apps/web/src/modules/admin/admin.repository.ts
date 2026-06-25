import { prisma } from "@dash/db";

export async function getAdminOverviewMetrics() {
  const [totalUsers, totalStores, activeStores, trialStores] = await Promise.all([
    prisma.user.count(),
    prisma.store.count(),
    prisma.store.count({
      where: {
        status: "ACTIVE"
      }
    }),
    prisma.store.count({
      where: {
        status: "DRAFT"
      }
    })
  ]);

  return {
    activeStores,
    paidStores: 0,
    totalRevenue: "৳0",
    totalStores,
    totalUsers,
    trialStores
  };
}
