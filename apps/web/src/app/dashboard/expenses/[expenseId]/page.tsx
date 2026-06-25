import { CalendarClock, Edit3, FileText, LinkIcon, ReceiptText, Trash2, WalletCards } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteConfirmationButton } from "../../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { archiveExpenseAction } from "../../../../modules/expenses/expense.actions";
import { CategoryPill, paymentMethodLabel } from "../../../../modules/expenses/components/expense-list";
import { ExpenseStatusBadge } from "../../../../modules/expenses/components/expense-status-badge";
import { getExpenseByIdForStore } from "../../../../modules/expenses/expense.service";
import { requireStore } from "../../../../modules/stores/queries";

type ExpenseDetailsPageProps = {
  params: Promise<{
    expenseId: string;
  }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ExpenseDetailsPage({ params, searchParams }: ExpenseDetailsPageProps) {
  const store = await requireStore();
  const { expenseId } = await params;
  const expense = await getExpenseByIdForStore(store.organizationId, store.id, expenseId);
  const message = getDetailsMessage(await searchParams);

  if (!expense) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Expenses</p>
            <h1 className="m-0 text-2xl font-semibold text-[#20212a]">{expense.expenseNumber}</h1>
            <p className="mt-2 text-sm text-[#777985]">{expense.title}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link className="secondary link-button min-h-10" href="/dashboard/expenses">
              Back to Expenses
            </Link>
            <Link className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#ddd6fe] bg-white px-4 text-xs font-semibold text-[#6d3cf5]" href={`/dashboard/expenses/${expense.id}/edit`}>
              <Edit3 className="h-3.5 w-3.5" /> Edit
            </Link>
            {expense.status !== "CANCELLED" ? (
              <DeleteConfirmationButton action={archiveExpenseAction.bind(null, expense.id)} ariaLabel={`Archive ${expense.expenseNumber}`} className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-xs font-semibold text-rose-700" title="Archive expense">
                <Trash2 className="h-3.5 w-3.5" /> Archive
              </DeleteConfirmationButton>
            ) : null}
          </div>
        </div>

        {message ? <p className="success-message">{message}</p> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,0.8fr)]">
          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ececf5] pb-4">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]"><ReceiptText className="h-6 w-6" /></span>
                <div>
                  <h2 className="m-0 text-base font-semibold">Expense Information</h2>
                  <p className="mt-1 text-xs text-[#85869a]">Core expense record</p>
                </div>
              </div>
              <ExpenseStatusBadge status={expense.status} />
            </header>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <InfoTile label="Title" value={expense.title} />
              <InfoTile label="Category" value={expense.category.name} />
              <InfoTile label="Amount" value={formatMoney(expense.amount.toString(), store.currency)} />
              <InfoTile label="Expense Date" value={formatDate(expense.expenseDate)} />
              <InfoTile label="Reference" value={expense.reference ?? "No reference"} />
              <InfoTile label="Created" value={formatDate(expense.createdAt)} />
            </dl>
          </section>

          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <h2 className="m-0 text-base font-semibold">Payment Information</h2>
            <div className="mt-5 grid gap-3">
              <SummaryMetric icon={WalletCards} label="Payment Method" value={paymentMethodLabel(expense.paymentMethod)} />
              <SummaryMetric icon={CalendarClock} label="Status" value={expense.status === "PAID" ? "Paid" : expense.status === "PENDING" ? "Pending" : "Cancelled"} />
              <div className="rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4">
                <span className="text-xs font-semibold text-[#777985]">Category</span>
                <div className="mt-2"><CategoryPill color={expense.category.color} name={expense.category.name} /></div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <h2 className="m-0 text-base font-semibold">Notes</h2>
            <p className="mb-0 mt-3 whitespace-pre-line text-sm leading-6 text-[#777985]">{expense.notes ?? "No notes added."}</p>
          </section>
          <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
            <h2 className="m-0 text-base font-semibold">Attachment Preview</h2>
            {expense.attachmentUrl ? (
              <a className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#ddd6fe] px-4 py-2 text-xs font-semibold text-[#6d3cf5]" href={expense.attachmentUrl} rel="noreferrer" target="_blank">
                <LinkIcon className="h-3.5 w-3.5" /> Open Attachment
              </a>
            ) : (
              <p className="mb-0 mt-3 text-sm text-[#777985]">No attachment URL added.</p>
            )}
          </section>
        </div>

        <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f3f0ff] text-[#7c3aed]"><FileText className="h-5 w-5" /></span>
          <h2 className="mb-0 mt-4 text-base font-semibold">Reports Ready</h2>
          <p className="mt-2 text-sm leading-6 text-[#777985]">This expense structure can feed future profit and loss, monthly expense charts, and expense reports.</p>
        </section>
      </section>
    </DashboardShell>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4">
      <dt className="text-xs font-semibold text-[#777985]">{label}</dt>
      <dd className="mb-0 mt-2 text-sm font-medium text-[#20212a]">{value}</dd>
    </div>
  );
}

function SummaryMetric({ icon: Icon, label, value }: { icon: typeof WalletCards; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-[#efedf7] bg-[#faf9ff] p-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f3f0ff] text-[#7c3aed]"><Icon className="h-4 w-4" /></span>
      <div>
        <span className="text-xs font-semibold text-[#777985]">{label}</span>
        <strong className="block text-sm text-[#20212a]">{value}</strong>
      </div>
    </div>
  );
}

function getDetailsMessage(searchParams: Record<string, string | string[] | undefined>) {
  if (searchParams.updated) return "Expense updated.";
  return null;
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}
