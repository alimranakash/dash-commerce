import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { ExpenseForm } from "../../../../../modules/expenses/components/expense-form";
import { updateExpenseFormAction } from "../../../../../modules/expenses/expense.actions";
import {
  getExpenseByIdForStore,
  getExpenseCategoriesForOrganization
} from "../../../../../modules/expenses/expense.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditExpensePageProps = {
  params: Promise<{
    expenseId: string;
  }>;
};

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const store = await requireStore();
  const { expenseId } = await params;
  const [expense, categories] = await Promise.all([
    getExpenseByIdForStore(store.organizationId, store.id, expenseId),
    getExpenseCategoriesForOrganization(store.organizationId)
  ]);

  if (!expense) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Expenses</p>
            <h1>Edit {expense.expenseNumber}</h1>
            <p className="auth-copy">Update expense details, payment method, and status.</p>
          </div>
          <Link className="secondary link-button" href={`/dashboard/expenses/${expense.id}`}>
            Back
          </Link>
        </div>
        <div className="panel-card">
          <ExpenseForm
            action={updateExpenseFormAction.bind(null, expense.id)}
            cancelHref={`/dashboard/expenses/${expense.id}`}
            categories={categories}
            expense={{
              amount: expense.amount.toString(),
              attachmentUrl: expense.attachmentUrl,
              categoryId: expense.categoryId,
              expenseDate: expense.expenseDate.toISOString().slice(0, 10),
              notes: expense.notes,
              paymentMethod: expense.paymentMethod,
              reference: expense.reference,
              status: expense.status,
              title: expense.title
            }}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
