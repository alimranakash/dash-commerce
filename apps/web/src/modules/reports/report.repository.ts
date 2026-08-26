import { prisma } from "@dash/db";
import { ensureProductVariantSchema } from "../products/product-variants.service";

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
    }),
    getProductVariantCount(storeId)
  ]);
}

export async function getProductVariantCount(storeId: string) {
  await ensureProductVariantSchema();

  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
    `SELECT COUNT(*) AS count FROM "${getDatabaseSchemaName()}"."ProductVariant" WHERE "storeId" = $1`,
    storeId
  );

  return Number(rows[0]?.count ?? 0);
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

export async function getProductsReportRecords(storeId: string, start: Date) {
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
      where: { order: { createdAt: { gte: start }, status: { not: "CANCELLED" }, storeId } },
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

function getDatabaseSchemaName() {
  const fallbackSchema = "public";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return fallbackSchema;
  }

  try {
    const schema = new URL(connectionString).searchParams.get("schema") ?? fallbackSchema;

    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(schema) ? schema : fallbackSchema;
  } catch {
    return fallbackSchema;
  }
}

/** Bundles that fired on orders in the window. */
export async function getBundleReportRecords(storeId: string, start: Date) {
  return prisma.orderBundle.findMany({
    where: {
      createdAt: {
        gte: start
      },
      order: {
        status: {
          not: "CANCELLED"
        }
      },
      storeId
    },
    select: {
      discountAmount: true,
      name: true,
      orderId: true,
      timesApplied: true
    }
  });
}

/**
 * Order lines in the window, with where each one came from.
 *
 * Cancelled orders are excluded the same way the best-seller pool excludes
 * them: an offer that was taken and then cancelled did not earn anything, and
 * counting it would flatter every merchandising surface at once.
 */
export async function getMerchandisingReportRecords(storeId: string, start: Date) {
  return prisma.orderItem.findMany({
    where: {
      order: {
        createdAt: {
          gte: start
        },
        status: {
          not: "CANCELLED"
        },
        storeId
      }
    },
    orderBy: {
      createdAt: "asc"
    },
    select: {
      order: {
        select: {
          createdAt: true,
          id: true
        }
      },
      quantity: true,
      source: true,
      title: true,
      total: true
    }
  });
}
