import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { FeatureGate } from "../../../../modules/billing/components/feature-gate";
import { IncompleteOrderDashboard } from "../../../../modules/abandoned-carts/components/incomplete-order-dashboard";
import {
  IncompleteOrderListControls,
  type IncompleteOrderFilterKey
} from "../../../../modules/abandoned-carts/components/incomplete-order-list-controls";
import {
  countActiveCheckoutSessions,
  getAbandonedCartInactivityMinutes,
  listIncompleteOrders
} from "../../../../modules/abandoned-carts/abandoned-cart.service";
import { requireStore } from "../../../../modules/stores/queries";

type IncompleteOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function IncompleteOrdersPage({ searchParams }: IncompleteOrdersPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const activeFilter = parseFilter(singleValue(params.status));
  const search = singleValue(params.search).trim();
  const dateRange = singleValue(params.dateRange).trim();
  const [orders, activeCheckoutCount] = await Promise.all([
    listIncompleteOrders(store, { dateRange, search }),
    countActiveCheckoutSessions(store.id)
  ]);
  const counts = {
    all: orders.length,
    contacted: orders.filter((order) => order.status === "CONTACTED").length,
    failed: orders.filter(
      (order) => order.status === "NOT_CONTACTED" && order.stage === "CHECKOUT_FAILED"
    ).length,
    recovered: orders.filter((order) => order.status === "RECOVERED").length,
    started: orders.filter(
      (order) => order.status === "NOT_CONTACTED" && order.stage !== "CHECKOUT_FAILED"
    ).length
  };

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page min-w-0">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>Incomplete Orders</h1>
            <p className="auth-copy">
              Checkouts that were filled in but never became orders. Call them back before they buy
              somewhere else.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FeatureGate feature="incomplete_orders" storeId={store.id} />
            <Link className="secondary link-button" href="/dashboard/reports/incomplete-orders">
              View Report
            </Link>
            <Link className="secondary link-button" href="/dashboard/abandoned-cart">
              Abandoned Carts
            </Link>
          </div>
        </div>
        <IncompleteOrderListControls
          activeFilter={activeFilter}
          counts={counts}
          dateRange={dateRange}
          search={search}
        />
        <IncompleteOrderDashboard
          activeCheckoutCount={activeCheckoutCount}
          activeFilter={activeFilter}
          currency={store.currency}
          inactivityMinutes={getAbandonedCartInactivityMinutes()}
          orders={orders}
          search={search}
          storeName={store.name}
        />
      </section>
    </DashboardShell>
  );
}

function parseFilter(value: string): IncompleteOrderFilterKey {
  const filters: IncompleteOrderFilterKey[] = [
    "failed",
    "started",
    "contacted",
    "recovered",
    "clean"
  ];

  return filters.includes(value as IncompleteOrderFilterKey)
    ? (value as IncompleteOrderFilterKey)
    : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
