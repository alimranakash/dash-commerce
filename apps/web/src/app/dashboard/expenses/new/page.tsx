import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { ExpenseForm } from "../../../../modules/expenses/components/expense-form";
import { createExpenseFormAction } from "../../../../modules/expenses/expense.actions";
import { getExpenseCategoriesForOrganization } from "../../../../modules/expenses/expense.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function NewExpensePage() {
  const store = await requireStore();
  const categories = await getExpenseCategoriesForOrganization(store.organizationId);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Expenses</p>
            <h1>Add expense</h1>
            <p className="auth-copy">Record an operating cost for this store.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/expenses">
            Back
          </Link>
        </div>
        <div className="panel-card">
          <ExpenseForm action={createExpenseFormAction} cancelHref="/dashboard/expenses" categories={categories} />
        </div>
      </section>
    </DashboardShell>
  );
}
