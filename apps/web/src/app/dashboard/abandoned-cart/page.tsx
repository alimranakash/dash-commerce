import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { AbandonedCartListControls, type AbandonedCartFilterKey } from "../../../modules/abandoned-carts/components/abandoned-cart-list-controls";
import { AbandonedCartDashboard, type AbandonedCartRecord } from "../../../modules/abandoned-carts/components/abandoned-cart-dashboard";
import { requireStore } from "../../../modules/stores/queries";

type AbandonedCartsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AbandonedCartsPage({ searchParams }: AbandonedCartsPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const carts: AbandonedCartRecord[] = [];
  const activeFilter = parseFilter(singleValue(params.status));
  const search = singleValue(params.search).trim();
  const counts = {
    all: carts.length,
    contacted: carts.filter((cart) => cart.status === "CONTACTED").length,
    "not-contacted": carts.filter((cart) => cart.status === "NOT_CONTACTED").length,
    recovered: carts.filter((cart) => cart.status === "RECOVERED").length
  };

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page min-w-0">
        <div className="catalog-page-heading"><h1>Abandoned Carts</h1></div>
        <AbandonedCartListControls
          activeFilter={activeFilter}
          counts={counts}
          dateRange={singleValue(params.dateRange).trim()}
          search={search}
        />
        <AbandonedCartDashboard activeFilter={activeFilter} carts={carts} currency={store.currency} search={search} />
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
