import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { TransactionDashboard } from "../../../modules/transactions/components/transaction-dashboard";
import { TransactionListControls, type TransactionFilterKey } from "../../../modules/transactions/components/transaction-list-controls";
import { getTransactionsForStore } from "../../../modules/transactions/transaction.service";
import type { TransactionRow } from "../../../modules/transactions/transaction.types";
import { requireStore } from "../../../modules/stores/queries";

type TransactionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const store = await requireStore();
  const summary = await getTransactionsForStore(store.id);
  const params = await searchParams;
  const activeFilter = parseTransactionFilter(singleValue(params.type));
  const search = singleValue(params.search).trim();
  const dateFrom = singleValue(params.dateFrom).trim();
  const dateTo = singleValue(params.dateTo).trim();
  const scopedRows = summary.rows.filter((row) => matchesTransactionSearch(row, search) && matchesTransactionDateRange(row, dateFrom, dateTo));
  const rows = scopedRows.filter((row) => matchesTransactionFilter(row, activeFilter));
  const counts: Record<TransactionFilterKey, number> = {
    adjustment: scopedRows.filter((row) => row.type === "ADJUSTMENT").length,
    all: scopedRows.length,
    payment: scopedRows.filter((row) => row.type === "PAYMENT").length,
    refund: scopedRows.filter((row) => row.type === "REFUND").length
  };

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)]">
        <div className="catalog-page-heading"><h1>Transactions</h1></div>
        <TransactionListControls
          activeFilter={activeFilter}
          counts={counts}
          dateFrom={dateFrom}
          dateTo={dateTo}
          search={search}
        />
        <TransactionDashboard currency={summary.rows[0]?.currency ?? store.currency} metrics={summary.metrics} rows={rows} />
      </section>
    </DashboardShell>
  );
}

function matchesTransactionFilter(row: TransactionRow, filter: TransactionFilterKey) {
  return filter === "all" || row.type === filter.toUpperCase();
}

function matchesTransactionSearch(row: TransactionRow, search: string) {
  if (!search) return true;
  const query = search.toLowerCase();
  return [row.id, row.orderNumber, row.customer, row.status, row.type].some((value) => value.toLowerCase().includes(query));
}

function matchesTransactionDateRange(row: TransactionRow, dateFrom: string, dateTo: string) {
  const createdAt = row.createdAt.getTime();
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

  if (from && !Number.isNaN(from.getTime()) && createdAt < from.getTime()) return false;
  if (to && !Number.isNaN(to.getTime()) && createdAt > to.getTime()) return false;

  return true;
}

function parseTransactionFilter(value: string): TransactionFilterKey {
  const filters: TransactionFilterKey[] = ["payment", "refund", "adjustment"];
  return filters.includes(value as TransactionFilterKey) ? value as TransactionFilterKey : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
