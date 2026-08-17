import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { AbandonedCartListControls, type AbandonedCartFilterKey } from "../../../modules/abandoned-carts/components/abandoned-cart-list-controls";
import { AbandonedCartDashboard } from "../../../modules/abandoned-carts/components/abandoned-cart-dashboard";
import {
  countActiveCarts,
  getAbandonedCartInactivityMinutes,
  listAbandonedCarts
} from "../../../modules/abandoned-carts/abandoned-cart.service";
import { FeatureGate } from "../../../modules/billing/components/feature-gate";
import { requireStore } from "../../../modules/stores/queries";

type AbandonedCartsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AbandonedCartsPage({ searchParams }: AbandonedCartsPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const activeFilter = parseFilter(singleValue(params.status));
  const search = singleValue(params.search).trim();
  const dateRange = singleValue(params.dateRange).trim();
  const [carts, activeCartCount] = await Promise.all([
    listAbandonedCarts(store, { dateRange, search }),
    countActiveCarts(store.id)
  ]);
  const counts = {
    all: carts.length,
    contacted: carts.filter((cart) => cart.status === "CONTACTED").length,
    "not-contacted": carts.filter((cart) => cart.status === "NOT_CONTACTED").length,
    recovered: carts.filter((cart) => cart.status === "RECOVERED").length
  };

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page min-w-0">
        <div className="catalog-page-heading">
          <h1>Abandoned Carts</h1>
          <FeatureGate feature="abandoned_cart" storeId={store.id} />
        </div>
        <AbandonedCartListControls
          activeFilter={activeFilter}
          counts={counts}
          dateRange={dateRange}
          search={search}
        />
        <AbandonedCartDashboard
          activeCartCount={activeCartCount}
          activeFilter={activeFilter}
          carts={carts}
          currency={store.currency}
          inactivityMinutes={getAbandonedCartInactivityMinutes()}
          search={search}
          storeName={store.name}
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
