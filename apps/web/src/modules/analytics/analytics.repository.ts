import { prisma } from "@dash/db";

const revenueOrderWhere = {
  status: {
    not: "CANCELLED" as const
  }
};

export async function getDashboardMetricsRecord(storeId: string) {
  const { startOfMonth, startOfTomorrow, startOfToday } = dateBoundaries();

  const [
    todayRevenue,
    thisMonthRevenue,
    totalOrders,
    pendingOrders,
    totalProducts,
    lowStockProducts
  ] = await Promise.all([
    prisma.order.aggregate({
      _sum: {
        totalAmount: true
      },
      where: {
        ...revenueOrderWhere,
        createdAt: {
          gte: startOfToday,
          lt: startOfTomorrow
        },
        storeId
      }
    }),
    prisma.order.aggregate({
      _sum: {
        totalAmount: true
      },
      where: {
        ...revenueOrderWhere,
        createdAt: {
          gte: startOfMonth
        },
        storeId
      }
    }),
    prisma.order.count({
      where: {
        storeId
      }
    }),
    prisma.order.count({
      where: {
        status: {
          in: ["PENDING", "CONFIRMED"]
        },
        storeId
      }
    }),
    prisma.product.count({
      where: {
        storeId
      }
    }),
    prisma.product.count({
      where: {
        storeId,
        stockQuantity: {
          lte: prisma.product.fields.lowStockThreshold
        }
      }
    })
  ]);

  return {
    lowStockProducts,
    pendingOrders,
    thisMonthRevenue: todayOrZero(thisMonthRevenue._sum.totalAmount),
    todayRevenue: todayOrZero(todayRevenue._sum.totalAmount),
    totalOrders,
    totalProducts
  };
}

export async function getRecentOrdersRecord(storeId: string, take = 6) {
  return prisma.order.findMany({
    where: {
      storeId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      createdAt: true,
      currency: true,
      customerName: true,
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true
    },
    take
  });
}

export async function getTopProductsRecord(storeId: string, take = 5) {
  const groups = await prisma.orderItem.groupBy({
    _sum: {
      quantity: true,
      total: true
    },
    by: ["productId"],
    orderBy: {
      _sum: {
        quantity: "desc"
      }
    },
    take,
    where: {
      order: {
        storeId,
        status: {
          not: "CANCELLED"
        }
      },
      productId: {
        not: null
      }
    }
  });
  const productIds = groups.map((group) => group.productId).filter((id): id is string => Boolean(id));
  const products = await prisma.product.findMany({
    where: {
      id: {
        in: productIds
      },
      storeId
    },
    select: {
      id: true,
      title: true
    }
  });
  const productsById = new Map(products.map((product) => [product.id, product]));

  return groups.map((group) => ({
    productId: group.productId ?? "unknown",
    quantitySold: group._sum.quantity ?? 0,
    revenue: todayOrZero(group._sum.total),
    title: productsById.get(group.productId ?? "")?.title ?? "Deleted product"
  }));
}

export async function getLowStockProductsRecord(storeId: string, take = 6) {
  return prisma.product.findMany({
    where: {
      storeId,
      stockQuantity: {
        lte: prisma.product.fields.lowStockThreshold
      }
    },
    orderBy: [
      {
        stockQuantity: "asc"
      },
      {
        updatedAt: "desc"
      }
    ],
    select: {
      id: true,
      lowStockThreshold: true,
      stockQuantity: true,
      title: true
    },
    take
  });
}

function dateBoundaries() {
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  return {
    startOfMonth,
    startOfToday,
    startOfTomorrow
  };
}

function todayOrZero(value: unknown) {
  return value ? String(value) : "0";
}
