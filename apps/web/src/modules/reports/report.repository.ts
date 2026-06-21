import { prisma } from "@dash/db";

export async function getReportOverviewRecords(storeId: string, periodStart: Date) {
  return Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: { gte: periodStart },
        storeId
      },
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        currency: true,
        customerEmail: true,
        customerId: true,
        customerName: true,
        customerPhone: true,
        paymentStatus: true,
        status: true,
        totalAmount: true,
        items: {
          select: {
            productId: true,
            quantity: true,
            title: true,
            total: true
          }
        }
      }
    }),
    prisma.product.aggregate({
      _avg: { price: true },
      _count: { _all: true },
      _sum: { stockQuantity: true },
      where: { storeId }
    }),
    prisma.customer.findMany({
      where: { storeId },
      select: {
        createdAt: true,
        id: true
      }
    })
  ]);
}
