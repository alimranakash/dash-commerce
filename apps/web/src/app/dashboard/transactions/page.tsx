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
  const rows = summary.rows.filter((row) => matchesTransactionFilter(row, activeFilter) && matchesTransactionSearch(row, search));
  const counts: Record<TransactionFilterKey, number> = {
    adjustment: summary.rows.filter((row) => row.type === "ADJUSTMENT").length,
    all: summary.rows.length,
    payment: summary.rows.filter((row) => row.type === "PAYMENT").length,
    refund: summary.rows.filter((row) => row.type === "REFUND").length
  };

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)]">
        <div className="catalog-page-heading"><h1>Transactions</h1></div>
        <TransactionListControls
          activeFilter={activeFilter}
          counts={counts}
          dateRange={singleValue(params.dateRange).trim()}
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

function parseTransactionFilter(value: string): TransactionFilterKey {
  const filters: TransactionFilterKey[] = ["payment", "refund", "adjustment"];
  return filters.includes(value as TransactionFilterKey) ? value as TransactionFilterKey : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
