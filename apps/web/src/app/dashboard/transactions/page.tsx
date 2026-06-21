import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { TransactionListControls, type TransactionFilterKey } from "../../../modules/transactions/components/transaction-list-controls";
import { requireStore } from "../../../modules/stores/queries";

type TransactionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const activeFilter = parseTransactionFilter(singleValue(params.type));

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading"><h1>Transactions</h1></div>
        <TransactionListControls
          activeFilter={activeFilter}
          dateRange={singleValue(params.dateRange).trim()}
          search={singleValue(params.search).trim()}
        />
      </section>
    </DashboardShell>
  );
}

function parseTransactionFilter(value: string): TransactionFilterKey {
  const filters: TransactionFilterKey[] = ["payment", "refund", "adjustment"];
  return filters.includes(value as TransactionFilterKey) ? value as TransactionFilterKey : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
