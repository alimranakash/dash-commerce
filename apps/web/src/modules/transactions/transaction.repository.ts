import { prisma } from "@dash/db";

export async function getTransactionSourceOrders(storeId: string) {
  return prisma.order.findMany({
    where: {
      status: { not: "CANCELLED" },
      storeId
    },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      currency: true,
      customerName: true,
      id: true,
      orderNumber: true,
      paymentReference: true,
      paymentStatus: true,
      totalAmount: true
    }
  });
}
