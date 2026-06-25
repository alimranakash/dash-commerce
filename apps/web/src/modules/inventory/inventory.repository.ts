import { prisma } from "@dash/db";
import type { StockMovementType } from "./inventory.schema";

export type StockMovementFilters = {
  productId?: string;
  query?: string;
  type?: StockMovementType | "ALL";
};

export async function getInventoryProductsForStore(storeId: string) {
  return prisma.product.findMany({
    where: {
      storeId
    },
    orderBy: {
      title: "asc"
    },
    select: {
      costPrice: true,
      id: true,
      price: true,
      sku: true,
      stockQuantity: true,
      title: true
    }
  });
}

export async function getStockMovementsForStore(
  organizationId: string,
  storeId: string,
  filters: StockMovementFilters = {}
) {
  const query = filters.query?.trim();

  return prisma.stockMovement.findMany({
    where: {
      organizationId,
      storeId,
      ...(filters.type && filters.type !== "ALL" ? { type: filters.type } : {}),
      ...(filters.productId ? { productId: filters.productId } : {}),
      ...(query
        ? {
            OR: [
              {
                reason: {
                  contains: query,
                  mode: "insensitive"
                }
              },
              {
                product: {
                  title: {
                    contains: query,
                    mode: "insensitive"
                  }
                }
              },
              {
                product: {
                  sku: {
                    contains: query,
                    mode: "insensitive"
                  }
                }
              }
            ]
          }
        : {})
    },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          title: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 100
  });
}

export async function getStockMovementsForProduct(
  organizationId: string,
  storeId: string,
  productId: string,
  take = 10
) {
  return prisma.stockMovement.findMany({
    where: {
      organizationId,
      productId,
      storeId
    },
    orderBy: {
      createdAt: "desc"
    },
    take
  });
}

export async function getInventorySummaryForStore(storeId: string) {
  const products = await prisma.product.findMany({
    where: {
      storeId
    },
    select: {
      costPrice: true,
      lowStockThreshold: true,
      price: true,
      stockQuantity: true
    }
  });

  return products.reduce(
    (summary, product) => {
      const stock = product.stockQuantity;
      const unitValue = Number(product.costPrice ?? product.price);

      return {
        lowStockProducts:
          stock > 0 && product.lowStockThreshold > 0 && stock <= product.lowStockThreshold
            ? summary.lowStockProducts + 1
            : summary.lowStockProducts,
        outOfStockProducts: stock <= 0 ? summary.outOfStockProducts + 1 : summary.outOfStockProducts,
        totalProducts: summary.totalProducts + 1,
        totalStockValue: summary.totalStockValue + stock * unitValue
      };
    },
    {
      lowStockProducts: 0,
      outOfStockProducts: 0,
      totalProducts: 0,
      totalStockValue: 0
    }
  );
}
