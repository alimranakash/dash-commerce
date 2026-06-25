import { ExpenseCategoryManagement } from "../../../../modules/expenses/components/expense-category-management";
import { getExpenseCategoriesForOrganization } from "../../../../modules/expenses/expense.service";
import { requireStore } from "../../../../modules/stores/queries";

type ExpenseCategoriesPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExpenseCategoriesPage({ searchParams }: ExpenseCategoriesPageProps) {
  const store = await requireStore();
  const categories = await getExpenseCategoriesForOrganization(store.organizationId);

  return (
    <ExpenseCategoryManagement
      categories={categories}
      message={getCategoryMessage(await searchParams)}
      storeSlug={store.slug}
    />
  );
}

function getCategoryMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.created) return "Expense category created.";
  if (searchParams.updated) return "Expense category updated.";
  if (searchParams.deleted) return "Expense category deleted.";
  if (searchParams.blocked) return "This category is used by expenses and cannot be deleted.";
  return null;
}
