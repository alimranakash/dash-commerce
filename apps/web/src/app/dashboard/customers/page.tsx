import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { CustomerListControls, type CustomerFilterKey } from "../../../modules/customers/components/customer-list-controls";
import { requireStore } from "../../../modules/stores/queries";

type CustomersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const store = await requireStore();
  const params = await searchParams;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading"><h1>Customers</h1></div>
        <CustomerListControls
          activeFilter={parseCustomerFilter(singleValue(params.type))}
          search={singleValue(params.search).trim()}
        />
      </section>
    </DashboardShell>
  );
}

function parseCustomerFilter(value: string): CustomerFilterKey {
  const filters: CustomerFilterKey[] = ["recurring", "one-time"];
  return filters.includes(value as CustomerFilterKey) ? value as CustomerFilterKey : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
