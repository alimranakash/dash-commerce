import { prisma } from "@dash/db";
import type { PurchaseStatus } from "./purchase.schema";

export const purchaseInclude = {
  items: {
    orderBy: {
      createdAt: "asc"
    }
  },
  supplier: true
} as const;

export async function getPurchasesForStore(
  organizationId: string,
  storeId: string,
  options: {
    search?: string;
    status?: PurchaseStatus | "ALL";
  } = {}
) {
  const query = options.search?.trim();

  return prisma.purchase.findMany({
    where: {
      organizationId,
      storeId,
      ...(options.status && options.status !== "ALL" ? { status: options.status } : {}),
      ...(query
        ? {
            OR: [
              { purchaseNumber: { contains: query, mode: "insensitive" } },
              { supplier: { name: { contains: query, mode: "insensitive" } } },
              { supplier: { companyName: { contains: query, mode: "insensitive" } } }
            ]
          }
        : {})
    },
    include: {
      _count: {
        select: {
          items: true
        }
      },
      supplier: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getPurchaseCountsForStore(organizationId: string, storeId: string) {
  const [all, draft, ordered, received, cancelled] = await Promise.all([
    prisma.purchase.count({ where: { organizationId, storeId } }),
    prisma.purchase.count({ where: { organizationId, storeId, status: "DRAFT" } }),
    prisma.purchase.count({ where: { organizationId, storeId, status: "ORDERED" } }),
    prisma.purchase.count({ where: { organizationId, storeId, status: "RECEIVED" } }),
    prisma.purchase.count({ where: { organizationId, storeId, status: "CANCELLED" } })
  ]);

  return { all, cancelled, draft, ordered, received };
}

export async function getPurchaseByIdForStore(organizationId: string, storeId: string, purchaseId: string) {
  return prisma.purchase.findFirst({
    where: {
      id: purchaseId,
      organizationId,
      storeId
    },
    include: purchaseInclude
  });
}

export async function getPurchaseNumberExists(storeId: string, purchaseNumber: string) {
  const purchase = await prisma.purchase.findFirst({
    where: {
      purchaseNumber,
      storeId
    },
    select: {
      id: true
    }
  });

  return Boolean(purchase);
}

export async function countPurchasesForStore(storeId: string) {
  return prisma.purchase.count({
    where: {
      storeId
    }
  });
}
