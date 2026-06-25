import { prisma } from "@dash/db";
import {
  countExpensesForStore,
  ensureDefaultExpenseCategories,
  getExpenseByIdForStore,
  getExpenseCategoriesForOrganization,
  getExpenseCategoryByIdForOrganization,
  getExpenseCountsForStore,
  getExpenseMetricsForStore,
  getExpenseNumberExists,
  getExpensesForStore,
  isExpenseCategoryInUse,
  type ExpenseFilters
} from "./expense.repository";
import {
  createExpenseSchema,
  expenseCategorySchema,
  updateExpenseSchema,
  type CreateExpenseInput,
  type ExpenseCategoryInput,
  type UpdateExpenseInput
} from "./expense.schema";

export {
  ensureDefaultExpenseCategories,
  getExpenseByIdForStore,
  getExpenseCategoriesForOrganization,
  getExpenseCategoryByIdForOrganization,
  getExpenseCountsForStore,
  getExpenseMetricsForStore,
  getExpensesForStore
};
export type { ExpenseFilters };

type ExpenseContext = {
  organizationId: string;
  storeId: string;
};

export async function createExpense(context: ExpenseContext, input: CreateExpenseInput) {
  const data = createExpenseSchema.parse(input);
  await assertExpenseCategory(context.organizationId, data.categoryId);
  const expenseNumber = await createExpenseNumber(context.storeId);

  return prisma.expense.create({
    data: {
      amount: data.amount,
      attachmentUrl: data.attachmentUrl ?? null,
      categoryId: data.categoryId,
      expenseDate: parseExpenseDate(data.expenseDate),
      expenseNumber,
      notes: data.notes ?? null,
      organizationId: context.organizationId,
      paymentMethod: data.paymentMethod,
      reference: data.reference ?? null,
      status: data.status,
      storeId: context.storeId,
      title: data.title
    }
  });
}

export async function updateExpense(
  context: ExpenseContext,
  expenseId: string,
  input: UpdateExpenseInput
) {
  const data = updateExpenseSchema.parse(input);
  const existing = await getExpenseByIdForStore(context.organizationId, context.storeId, expenseId);

  if (!existing) {
    return null;
  }

  await assertExpenseCategory(context.organizationId, data.categoryId);

  return prisma.expense.update({
    where: {
      id: expenseId
    },
    data: {
      amount: data.amount,
      attachmentUrl: data.attachmentUrl ?? null,
      categoryId: data.categoryId,
      expenseDate: parseExpenseDate(data.expenseDate),
      notes: data.notes ?? null,
      paymentMethod: data.paymentMethod,
      reference: data.reference ?? null,
      status: data.status,
      title: data.title
    }
  });
}

export async function archiveExpense(context: ExpenseContext, expenseId: string) {
  const result = await prisma.expense.updateMany({
    where: {
      id: expenseId,
      organizationId: context.organizationId,
      storeId: context.storeId
    },
    data: {
      status: "CANCELLED"
    }
  });

  return result.count > 0;
}

export async function createExpenseCategory(organizationId: string, input: ExpenseCategoryInput) {
  const data = expenseCategorySchema.parse(input);
  await ensureDefaultExpenseCategories(organizationId);

  return prisma.expenseCategory.create({
    data: {
      organizationId,
      ...data
    }
  });
}

export async function updateExpenseCategory(
  organizationId: string,
  categoryId: string,
  input: ExpenseCategoryInput
) {
  const data = expenseCategorySchema.parse(input);
  const category = await getExpenseCategoryByIdForOrganization(organizationId, categoryId);

  if (!category) {
    return null;
  }

  return prisma.expenseCategory.update({
    where: {
      id: categoryId
    },
    data
  });
}

export async function deleteExpenseCategory(organizationId: string, categoryId: string) {
  const category = await getExpenseCategoryByIdForOrganization(organizationId, categoryId);

  if (!category) {
    return false;
  }

  if (await isExpenseCategoryInUse(organizationId, categoryId)) {
    throw new Error("This category is used by expenses and cannot be deleted.");
  }

  const result = await prisma.expenseCategory.deleteMany({
    where: {
      id: categoryId,
      organizationId
    }
  });

  return result.count > 0;
}

async function createExpenseNumber(storeId: string) {
  const count = await countExpensesForStore(storeId);

  for (let offset = 1; offset < 20; offset += 1) {
    const expenseNumber = `EXP-${String(count + offset).padStart(6, "0")}`;
    if (!(await getExpenseNumberExists(storeId, expenseNumber))) {
      return expenseNumber;
    }
  }

  return `EXP-${Date.now()}`;
}

async function assertExpenseCategory(organizationId: string, categoryId: string) {
  const category = await getExpenseCategoryByIdForOrganization(organizationId, categoryId);

  if (!category) {
    throw new Error("Expense category not found for this organization.");
  }
}

function parseExpenseDate(value: string) {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Use a valid expense date.");
  }

  return date;
}
