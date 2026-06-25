import { Edit3, Eye, Plus, Search, Tags, Trash2 } from "lucide-react";
import Link from "next/link";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { archiveExpenseAction } from "../expense.actions";
import type { ExpensePaymentMethod, ExpenseStatus } from "../expense.schema";
import { ExpenseStatusBadge } from "./expense-status-badge";

type ExpenseListItem = {
  amount: { toString(): string };
  category: {
    color: string;
    name: string;
  };
  expenseDate: Date;
  expenseNumber: string;
  id: string;
  paymentMethod: ExpensePaymentMethod;
  status: ExpenseStatus;
  title: string;
};

type ExpenseCategory = {
  id: string;
  name: string;
};

type ExpenseListProps = {
  categories: ExpenseCategory[];
  currency: string;
  dateFrom?: string;
  dateTo?: string;
  expenses: ExpenseListItem[];
  filters: {
    categoryId?: string;
    status?: string;
  };
  message?: string | null;
  metrics: {
    paid: string;
    pending: string;
    thisMonth: string;
    total: string;
  };
  search?: string;
  storeSlug: string;
};

export function ExpenseList({ categories, currency, dateFrom, dateTo, expenses, filters, message, metrics, search, storeSlug }: ExpenseListProps) {
  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="mx-auto grid max-w-[1480px] gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold text-[#20212a]">Expenses</h1>
            <p className="mt-2 text-sm text-[#777985]">Track operating costs and prepare for profit reports.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#ddd6fe] bg-white px-4 text-xs font-semibold text-[#6d3cf5]" href="/dashboard/expenses/categories">
              <Tags className="h-3.5 w-3.5" /> Categories
            </Link>
            <Link className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6d28d9]" href="/dashboard/expenses/new">
              <Plus className="h-3.5 w-3.5" /> Add Expense
            </Link>
          </div>
        </div>

        {message ? <p className="success-message">{message}</p> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Total Expenses" value={formatMoney(metrics.total, currency)} />
          <MetricCard label="This Month" value={formatMoney(metrics.thisMonth, currency)} />
          <MetricCard label="Pending Expenses" value={formatMoney(metrics.pending, currency)} />
          <MetricCard label="Paid Expenses" value={formatMoney(metrics.paid, currency)} />
        </div>

        <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <form className="mb-5 grid gap-3 lg:grid-cols-[minmax(180px,1fr)_150px_150px_170px_150px_auto]" action="/dashboard/expenses">
            <input className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10" defaultValue={search} name="search" placeholder="Search expenses" type="search" />
            <input className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none" defaultValue={dateFrom} name="dateFrom" title="Date from" type="date" />
            <input className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none" defaultValue={dateTo} name="dateTo" title="Date to" type="date" />
            <select className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none" defaultValue={filters.categoryId ?? ""} name="categoryId">
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.name}</option>
              ))}
            </select>
            <select className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none" defaultValue={filters.status ?? ""} name="status">
              <option value="">All status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white" type="submit">
              <Search className="h-3.5 w-3.5" /> Search
            </button>
          </form>

          {expenses.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] border-collapse text-left text-xs">
                <thead className="bg-[#f7f7f9] text-[#34353e]">
                  <tr>
                    <th className="rounded-l-md px-4 py-3 font-medium">Expense No</th>
                    <th className="px-3 py-3 font-medium">Title</th>
                    <th className="px-3 py-3 font-medium">Category</th>
                    <th className="px-3 py-3 font-medium">Amount</th>
                    <th className="px-3 py-3 font-medium">Payment Method</th>
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="rounded-r-md px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => (
                    <tr className="border-b border-[#efeff4] transition hover:bg-[#fcfbff]" key={expense.id}>
                      <td className="px-4 py-5 font-semibold text-[#34353e]">{expense.expenseNumber}</td>
                      <td className="px-3 py-5 font-medium text-[#34353e]">{expense.title}</td>
                      <td className="px-3 py-5"><CategoryPill color={expense.category.color} name={expense.category.name} /></td>
                      <td className="px-3 py-5 font-semibold">{formatMoney(expense.amount.toString(), currency)}</td>
                      <td className="px-3 py-5 text-[#555660]">{paymentMethodLabel(expense.paymentMethod)}</td>
                      <td className="px-3 py-5 text-[#555660]">{formatDate(expense.expenseDate)}</td>
                      <td className="px-3 py-5"><ExpenseStatusBadge status={expense.status} /></td>
                      <td className="px-4 py-5">
                        <div className="catalog-row-actions">
                          <Link aria-label={`View ${expense.expenseNumber}`} href={`/dashboard/expenses/${expense.id}`} title="View expense"><Eye aria-hidden="true" /></Link>
                          <Link aria-label={`Edit ${expense.expenseNumber}`} href={`/dashboard/expenses/${expense.id}/edit`} title="Edit expense"><Edit3 aria-hidden="true" /></Link>
                          <DeleteConfirmationButton action={archiveExpenseAction.bind(null, expense.id)} ariaLabel={`Archive ${expense.expenseNumber}`} title="Archive expense"><Trash2 aria-hidden="true" /></DeleteConfirmationButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeedf5] pt-4 text-xs text-[#777985]">
                <span>Showing {expenses.length} expenses</span>
                <span className="rounded-full border border-[#e4e1f3] bg-[#faf9ff] px-3 py-1">Page 1 of 1</span>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[360px] place-items-center text-center">
              <div>
                <h2 className="text-lg font-semibold text-[#20212a]">No expenses found</h2>
                <p className="mt-2 text-sm text-[#777985]">Add your first expense to start tracking operating costs.</p>
                <Link className="mt-4 inline-flex h-10 items-center rounded-lg border border-[#7c3aed] px-4 text-xs font-semibold text-[#6d3cf5]" href="/dashboard/expenses/new">Add Expense</Link>
              </div>
            </div>
          )}
        </section>
      </section>
    </DashboardShell>
  );
}

export function CategoryPill({ color, name }: { color: string; name: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-[#f7f5ff] px-2.5 py-1 text-[11px] font-semibold text-[#34353e]">
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <span className="text-xs font-semibold text-[#777985]">{label}</span>
      <strong className="mt-2 block text-xl text-[#20212a]">{value}</strong>
    </section>
  );
}

export function paymentMethodLabel(value: ExpensePaymentMethod) {
  const labels: Record<ExpensePaymentMethod, string> = {
    BANK: "Bank",
    BKASH: "bKash",
    CARD: "Card",
    CASH: "Cash",
    NAGAD: "Nagad",
    OTHER: "Other"
  };

  return labels[value];
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}
