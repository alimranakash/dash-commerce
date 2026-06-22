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

export async function getOrdersReportRecords(storeId: string, start: Date) {
  return prisma.order.findMany({
    where: { createdAt: { gte: start }, storeId },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      currency: true,
      customerName: true,
      id: true,
      orderNumber: true,
      paymentStatus: true,
      status: true,
      totalAmount: true
    }
  });
}

export async function getRevenueReportRecords(storeId: string, start: Date) {
  return prisma.order.findMany({
    where: { createdAt: { gte: start }, storeId },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      currency: true,
      paymentStatus: true,
      status: true,
      totalAmount: true
    }
  });
}

export async function getProductsReportRecords(storeId: string) {
  return Promise.all([
    prisma.product.findMany({
      where: { storeId },
      orderBy: { title: "asc" },
      select: {
        category: { select: { name: true } },
        id: true,
        lowStockThreshold: true,
        price: true,
        status: true,
        stockQuantity: true,
        title: true
      }
    }),
    prisma.orderItem.findMany({
      where: { order: { status: { not: "CANCELLED" }, storeId } },
      select: {
        productId: true,
        quantity: true,
        title: true,
        total: true,
        product: { select: { category: { select: { name: true } } } }
      }
    })
  ]);
}

export async function getCustomersReportRecords(storeId: string) {
  return prisma.customer.findMany({
    where: { storeId },
    orderBy: { createdAt: "asc" },
    select: {
      createdAt: true,
      id: true,
      name: true,
      orders: {
        where: { status: { not: "CANCELLED" } },
        select: {
          currency: true,
          totalAmount: true
        }
      }
    }
  });
}
