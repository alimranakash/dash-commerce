import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { CustomerDashboard } from "../../../modules/customers/components/customer-dashboard";
import { CustomerListControls, type CustomerFilterKey } from "../../../modules/customers/components/customer-list-controls";
import { getCustomersForStore } from "../../../modules/customers/customer.service";
import type { CustomerRow } from "../../../modules/customers/customer.types";
import { requireStore } from "../../../modules/stores/queries";

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const store = await requireStore();
  const summary = await getCustomersForStore(store.id, store.currency);
  const params = await searchParams;
  const activeFilter = parseCustomerFilter(singleValue(params.type));
  const search = singleValue(params.search).trim();
  const rows = summary.rows.filter((customer) => matchesCustomerFilter(customer, activeFilter) && matchesCustomerSearch(customer, search));
  const counts: Record<CustomerFilterKey, number> = {
    all: summary.rows.length,
    recurring: summary.rows.filter((customer) => customer.orderCount > 1).length,
    "one-time": summary.rows.filter((customer) => customer.orderCount === 1).length
  };

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page w-full max-w-full min-w-0 grid-cols-[minmax(0,1fr)]">
        <div className="catalog-page-heading"><h1>Customers</h1></div>
        <CustomerListControls
          activeFilter={activeFilter}
          counts={counts}
          search={search}
        />
        <CustomerDashboard currency={summary.rows[0]?.currency ?? store.currency} metrics={summary.metrics} rows={rows} />
      </section>
    </DashboardShell>
  );
}

function matchesCustomerFilter(customer: CustomerRow, filter: CustomerFilterKey) {
  if (filter === "recurring") return customer.orderCount > 1;
  if (filter === "one-time") return customer.orderCount === 1;
  return true;
}

function matchesCustomerSearch(customer: CustomerRow, search: string) {
  if (!search) return true;
  const query = search.toLowerCase();
  return [customer.name, customer.email, customer.phone].some((value) => value?.toLowerCase().includes(query));
}

function parseCustomerFilter(value: string): CustomerFilterKey {
  const filters: CustomerFilterKey[] = ["recurring", "one-time"];
  return filters.includes(value as CustomerFilterKey) ? value as CustomerFilterKey : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
