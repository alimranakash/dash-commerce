import { prisma } from "@dash/db";

export async function getAdminOverviewMetrics() {
  const [totalUsers, totalStores, activeStores, trialStores, paidStores, paidRevenue] = await Promise.all([
    prisma.user.count(),
    prisma.store.count({
      where: {
        status: {
          not: "ARCHIVED"
        }
      }
    }),
    prisma.store.count({
      where: {
        status: "ACTIVE"
      }
    }),
    prisma.store.count({
      where: {
        status: "DRAFT"
      }
    }),
    prisma.subscription.count({
      where: {
        status: "ACTIVE"
      }
    }),
    prisma.payment.aggregate({
      _sum: {
        amount: true
      },
      where: {
        status: "PAID"
      }
    })
  ]);

  return {
    activeStores,
    paidStores,
    totalRevenue: `BDT ${Number(paidRevenue._sum.amount ?? 0).toLocaleString("en", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2
    })}`,
    totalStores,
    totalUsers,
    trialStores
  };
}
