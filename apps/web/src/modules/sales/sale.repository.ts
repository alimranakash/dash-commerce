import { prisma } from "@dash/db";
import {
  dailyReportWhere,
  type DailyReportScope,
  type DailySalesFacts,
  type DailyTransactionRecord
} from "./sale-daily-report";
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

/**
 * One business day's sums, added up by the database: by status, by payment
 * method, the line discounts, and what is still owed up to that day. No sale
 * row leaves the database for these — only the transaction table reads rows.
 */
export async function getDailySalesFacts(
  scope: DailyReportScope,
  day: string
): Promise<DailySalesFacts> {
  const where = dailyReportWhere(scope, day);
  const [byStatus, byMethod, lines, withDue, outstanding] = await Promise.all([
    prisma.sale.groupBy({
      _count: { _all: true },
      _sum: {
        discount: true,
        dueAmount: true,
        paidAmount: true,
        shipping: true,
        subtotal: true,
        tax: true,
        total: true
      },
      by: ["status"],
      where: where.onDay
    }),
    prisma.sale.groupBy({
      _count: { _all: true },
      _sum: {
        dueAmount: true,
        paidAmount: true,
        total: true
      },
      by: ["paymentMethod"],
      where: where.completed
    }),
    prisma.saleItem.aggregate({
      _sum: {
        discount: true
      },
      where: {
        sale: where.completed
      }
    }),
    prisma.sale.count({
      where: where.completedWithDue
    }),
    prisma.sale.aggregate({
      _count: { _all: true },
      _sum: {
        dueAmount: true
      },
      where: where.outstanding
    })
  ]);

  return {
    byMethod: byMethod.map((row) => ({
      count: row._count._all,
      method: row.paymentMethod,
      sums: row._sum
    })),
    byStatus: byStatus.map((row) => ({
      count: row._count._all,
      status: row.status,
      sums: row._sum
    })),
    completedLineDiscount: lines._sum.discount,
    completedWithDue: withDue,
    outstanding: { count: outstanding._count._all, dueAmount: outstanding._sum.dueAmount }
  };
}

/** One page of the day's sales, oldest first, with the customer's name and nothing else of theirs. */
export async function getDailySaleTransactions(
  scope: DailyReportScope,
  day: string,
  page: { skip: number; take: number }
): Promise<DailyTransactionRecord[]> {
  return prisma.sale.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      completedAt: true,
      createdAt: true,
      customer: {
        select: {
          name: true
        }
      },
      dueAmount: true,
      id: true,
      paidAmount: true,
      paymentMethod: true,
      saleNumber: true,
      status: true,
      total: true
    },
    skip: page.skip,
    take: page.take,
    where: dailyReportWhere(scope, day).transactions
  });
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
