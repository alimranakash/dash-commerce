import { prisma } from "@dash/db";
import type { ExpensePaymentMethod, ExpenseStatus } from "./expense.schema";

export const DEFAULT_EXPENSE_CATEGORIES = [
  { color: "#7C3AED", icon: "megaphone", name: "Marketing" },
  { color: "#2563EB", icon: "truck", name: "Courier" },
  { color: "#D97706", icon: "package", name: "Packaging" },
  { color: "#059669", icon: "users", name: "Salary" },
  { color: "#DB2777", icon: "building", name: "Office Rent" },
  { color: "#0891B2", icon: "wifi", name: "Internet" },
  { color: "#65A30D", icon: "bolt", name: "Utilities" },
  { color: "#4F46E5", icon: "monitor", name: "Software & Tools" },
  { color: "#EA580C", icon: "plane", name: "Travel" },
  { color: "#64748B", icon: "receipt", name: "Miscellaneous" }
] as const;

export type ExpenseFilters = {
  categoryId?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: ExpensePaymentMethod | "ALL";
  search?: string;
  status?: ExpenseStatus | "ALL";
};

export async function ensureDefaultExpenseCategories(organizationId: string) {
  await prisma.$transaction(
    DEFAULT_EXPENSE_CATEGORIES.map((category) =>
      prisma.expenseCategory.upsert({
        where: {
          organizationId_name: {
            name: category.name,
            organizationId
          }
        },
        create: {
          organizationId,
          ...category
        },
        update: {}
      })
    )
  );
}

export async function getExpenseCategoriesForOrganization(organizationId: string) {
  await ensureDefaultExpenseCategories(organizationId);

  return prisma.expenseCategory.findMany({
    where: {
      organizationId
    },
    orderBy: {
      name: "asc"
    }
  });
}

export async function getExpenseCategoryByIdForOrganization(organizationId: string, categoryId: string) {
  return prisma.expenseCategory.findFirst({
    where: {
      id: categoryId,
      organizationId
    }
  });
}

export async function getExpenseCategoryByNameForOrganization(organizationId: string, name: string) {
  return prisma.expenseCategory.findFirst({
    where: {
      name: {
        equals: name,
        mode: "insensitive"
      },
      organizationId
    },
    select: {
      id: true
    }
  });
}

export async function getExpensesForStore(organizationId: string, storeId: string, filters: ExpenseFilters = {}) {
  const query = filters.search?.trim();
  const dateRange = dateFilter(filters.dateFrom, filters.dateTo);

  return prisma.expense.findMany({
    where: {
      organizationId,
      storeId,
      ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
      ...(filters.status && filters.status !== "ALL" ? { status: filters.status } : {}),
      ...(filters.paymentMethod && filters.paymentMethod !== "ALL" ? { paymentMethod: filters.paymentMethod } : {}),
      ...(dateRange ? { expenseDate: dateRange } : {}),
      ...(query
        ? {
            OR: [
              { expenseNumber: { contains: query, mode: "insensitive" } },
              { title: { contains: query, mode: "insensitive" } },
              { reference: { contains: query, mode: "insensitive" } },
              { category: { name: { contains: query, mode: "insensitive" } } }
            ]
          }
        : {})
    },
    include: {
      category: true
    },
    orderBy: {
      expenseDate: "desc"
    }
  });
}

export async function getExpenseByIdForStore(organizationId: string, storeId: string, expenseId: string) {
  return prisma.expense.findFirst({
    where: {
      id: expenseId,
      organizationId,
      storeId
    },
    include: {
      category: true
    }
  });
}

export async function getExpenseCountsForStore(organizationId: string, storeId: string) {
  const [all, paid, pending, cancelled] = await Promise.all([
    prisma.expense.count({ where: { organizationId, storeId } }),
    prisma.expense.count({ where: { organizationId, storeId, status: "PAID" } }),
    prisma.expense.count({ where: { organizationId, storeId, status: "PENDING" } }),
    prisma.expense.count({ where: { organizationId, storeId, status: "CANCELLED" } })
  ]);

  return { all, cancelled, paid, pending };
}

export async function getExpenseMetricsForStore(organizationId: string, storeId: string) {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const [total, month, pending, paid] = await Promise.all([
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { organizationId, storeId, status: { not: "CANCELLED" } }
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { expenseDate: { gte: monthStart, lt: nextMonth }, organizationId, storeId, status: { not: "CANCELLED" } }
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { organizationId, status: "PENDING", storeId }
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { organizationId, status: "PAID", storeId }
    })
  ]);

  return {
    paid: paid._sum.amount?.toString() ?? "0",
    pending: pending._sum.amount?.toString() ?? "0",
    thisMonth: month._sum.amount?.toString() ?? "0",
    total: total._sum.amount?.toString() ?? "0"
  };
}

export async function countExpensesForStore(storeId: string) {
  return prisma.expense.count({
    where: {
      storeId
    }
  });
}

export async function getExpenseNumberExists(storeId: string, expenseNumber: string) {
  const expense = await prisma.expense.findFirst({
    where: {
      expenseNumber,
      storeId
    },
    select: {
      id: true
    }
  });

  return Boolean(expense);
}

export async function isExpenseCategoryInUse(organizationId: string, categoryId: string) {
  const count = await prisma.expense.count({
    where: {
      categoryId,
      organizationId
    }
  });

  return count > 0;
}

function dateFilter(dateFrom?: string, dateTo?: string) {
  if (!dateFrom && !dateTo) return undefined;

  return {
    ...(dateFrom ? { gte: new Date(`${dateFrom}T00:00:00`) } : {}),
    ...(dateTo ? { lte: new Date(`${dateTo}T23:59:59`) } : {})
  };
}
