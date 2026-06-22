import { prisma } from "@dash/db";

export async function getCustomerRecordsForStore(storeId: string) {
  return prisma.customer.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      email: true,
      id: true,
      name: true,
      phone: true,
      orders: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          currency: true,
          totalAmount: true
        }
      }
    }
  });
}
