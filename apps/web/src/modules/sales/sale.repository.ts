import { prisma } from "@dash/db";
import type { SaleStatus, SaleType } from "./sale.schema";

export type SaleFilters = {
  dateFrom?: string;
  dateTo?: string;
  saleType?: SaleType | "ALL";
  search?: string;
  status?: SaleStatus | "ALL";
};

export const saleInclude = {
  customer: true,
  items: {
    orderBy: {
      productName: "asc"
    }
  }
} as const;

export async function getSalesForStore(organizationId: string, storeId: string, filters: SaleFilters = {}) {
  const query = filters.search?.trim();
  const dateRange = dateFilter(filters.dateFrom, filters.dateTo);

  return prisma.sale.findMany({
    where: {
      organizationId,
      storeId,
      ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
      ...(filters.saleType && filters.saleType !== "ALL" ? { saleType: filters.saleType } : {}),
      ...(dateRange ? { saleDate: dateRange } : {}),
      ...(query
        ? {
            OR: [
              { saleNumber: { contains: query, mode: "insensitive" } },
              { customer: { name: { contains: query, mode: "insensitive" } } },
              { customer: { phone: { contains: query, mode: "insensitive" } } }
            ]
          }
        : {})
    },
    include: {
      customer: true
    },
    orderBy: {
      saleDate: "desc"
    }
  });
}

export async function getSaleByIdForStore(organizationId: string, storeId: string, saleId: string) {
  return prisma.sale.findFirst({
    where: {
      id: saleId,
      organizationId,
      storeId
    },
    include: saleInclude
  });
}

export async function getSaleMetricsForStore(organizationId: string, storeId: string) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const activeWhere = { organizationId, status: { not: "CANCELLED" as const }, storeId };
  const [total, today, month, pending] = await Promise.all([
    prisma.sale.aggregate({ _sum: { total: true }, where: activeWhere }),
    prisma.sale.aggregate({ _sum: { total: true }, where: { ...activeWhere, saleDate: { gte: todayStart, lt: tomorrow } } }),
    prisma.sale.aggregate({ _sum: { total: true }, where: { ...activeWhere, saleDate: { gte: monthStart, lt: nextMonth } } }),
    prisma.sale.aggregate({ _sum: { dueAmount: true }, where: { organizationId, paymentStatus: { in: ["PARTIAL", "UNPAID"] }, status: { not: "CANCELLED" }, storeId } })
  ]);

  return {
    pendingPayments: pending._sum.dueAmount?.toString() ?? "0",
    thisMonth: month._sum.total?.toString() ?? "0",
    today: today._sum.total?.toString() ?? "0",
    total: total._sum.total?.toString() ?? "0"
  };
}

export async function countSalesForStore(storeId: string) {
  return prisma.sale.count({
    where: {
      storeId
    }
  });
}

export async function getSaleNumberExists(storeId: string, saleNumber: string) {
  const sale = await prisma.sale.findFirst({
    where: {
      saleNumber,
      storeId
    },
    select: {
      id: true
    }
  });

  return Boolean(sale);
}

function dateFilter(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return undefined;

  return {
    ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
    ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59`) } : {})
  };
}
