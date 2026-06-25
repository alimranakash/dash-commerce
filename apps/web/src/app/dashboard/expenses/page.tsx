import { ExpenseList } from "../../../modules/expenses/components/expense-list";
import { expenseStatusSchema, type ExpenseStatus } from "../../../modules/expenses/expense.schema";
import {
  getExpenseCategoriesForOrganization,
  getExpenseMetricsForStore,
  getExpensesForStore
} from "../../../modules/expenses/expense.service";
import { requireStore } from "../../../modules/stores/queries";

type ExpensesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const search = valueOf(params.search);
  const categoryId = valueOf(params.categoryId);
  const status = statusFromParam(valueOf(params.status));
  const dateFrom = valueOf(params.dateFrom);
  const dateTo = valueOf(params.dateTo);
  const filters = {
    ...(categoryId ? { categoryId } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {}),
    search,
    status
  };
  const [categories, expenses, metrics] = await Promise.all([
    getExpenseCategoriesForOrganization(store.organizationId),
    getExpensesForStore(store.organizationId, store.id, filters),
    getExpenseMetricsForStore(store.organizationId, store.id)
  ]);

  return (
    <ExpenseList
      categories={categories}
      currency={store.currency}
      dateFrom={dateFrom}
      dateTo={dateTo}
      expenses={expenses}
      filters={{ categoryId, status: status === "ALL" ? "" : status.toLowerCase() }}
      message={getExpensesMessage(params)}
      metrics={metrics}
      search={search}
      storeSlug={store.slug}
    />
  );
}

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function statusFromParam(value: string): ExpenseStatus | "ALL" {
  const parsed = expenseStatusSchema.safeParse(value.toUpperCase());
  return parsed.success ? parsed.data : "ALL";
}

function getExpensesMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.created) return "Expense created.";
  if (searchParams.archived) return "Expense archived.";
  return null;
}
