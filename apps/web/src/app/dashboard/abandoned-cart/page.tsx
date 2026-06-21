import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { AbandonedCartListControls, type AbandonedCartFilterKey } from "../../../modules/abandoned-carts/components/abandoned-cart-list-controls";
import { requireStore } from "../../../modules/stores/queries";

type AbandonedCartsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AbandonedCartsPage({ searchParams }: AbandonedCartsPageProps) {
  const store = await requireStore();
  const params = await searchParams;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading"><h1>Abandoned Carts</h1></div>
        <AbandonedCartListControls
          activeFilter={parseFilter(singleValue(params.status))}
          dateRange={singleValue(params.dateRange).trim()}
          search={singleValue(params.search).trim()}
        />
      </section>
    </DashboardShell>
  );
}

function parseFilter(value: string): AbandonedCartFilterKey {
  const filters: AbandonedCartFilterKey[] = ["not-contacted", "contacted", "recovered", "clean"];
  return filters.includes(value as AbandonedCartFilterKey) ? value as AbandonedCartFilterKey : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
