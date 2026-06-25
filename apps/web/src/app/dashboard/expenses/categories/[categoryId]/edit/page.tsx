import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../../components/dashboard/dashboard-shell";
import { ExpenseCategoryForm } from "../../../../../../modules/expenses/components/expense-category-form";
import { updateExpenseCategoryFormAction } from "../../../../../../modules/expenses/expense.actions";
import { getExpenseCategoryByIdForOrganization } from "../../../../../../modules/expenses/expense.service";
import { requireStore } from "../../../../../../modules/stores/queries";

type EditExpenseCategoryPageProps = {
  params: Promise<{
    categoryId: string;
  }>;
};

export default async function EditExpenseCategoryPage({ params }: EditExpenseCategoryPageProps) {
  const store = await requireStore();
  const { categoryId } = await params;
  const category = await getExpenseCategoryByIdForOrganization(store.organizationId, categoryId);

  if (!category) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Expenses</p>
            <h1>Edit expense category</h1>
            <p className="auth-copy">Update the category label, color, and icon name.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/expenses/categories">
            Back
          </Link>
        </div>
        <div className="panel-card">
          <ExpenseCategoryForm
            action={updateExpenseCategoryFormAction.bind(null, category.id)}
            category={{
              color: category.color,
              icon: category.icon,
              name: category.name
            }}
            submitLabel="Save Category"
          />
        </div>
      </section>
    </DashboardShell>
  );
}
