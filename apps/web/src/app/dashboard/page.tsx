import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { DashboardCard } from "../../components/dashboard/dashboard-card";
import { requireUser } from "../../lib/auth";
import { AbandonedCarts } from "../../modules/analytics/components/abandoned-carts";
import { LowStockProducts } from "../../modules/analytics/components/low-stock-products";
import { MetricCard } from "../../modules/analytics/components/metric-card";
import { RecentOrders } from "../../modules/analytics/components/recent-orders";
import { RecentSales } from "../../modules/analytics/components/recent-sales";
import { SetupStatus } from "../../modules/analytics/components/setup-status";
import { TopProducts } from "../../modules/analytics/components/top-products";
import {
  getDashboardMetrics,
  getLowStockProducts,
  getRecentOrders,
  getTopProducts
} from "../../modules/analytics/analytics.service";
import { LogoutButton } from "../../modules/auth/logout-button";
import { OnboardingForm } from "../../modules/onboarding/onboarding-form";
import { getCurrentStore } from "../../modules/stores/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const store = await getCurrentStore();

  if (!store) {
    return (
      <main className="dashboard-page">
        <section className="onboarding-shell" aria-labelledby="onboarding-title">
          <div className="dashboard-header">
            <div>
              <p className="eyebrow">Workspace setup</p>
              <h1 id="onboarding-title">Create your organization and first store</h1>
              <p className="auth-copy">
                Welcome, {user.name ?? user.email}. This creates your owner organization, store,
                and default Dash subdomain.
              </p>
            </div>
            <LogoutButton />
          </div>
          <OnboardingForm />
        </section>
      </main>
    );
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <DashboardOverview
        currency={store.currency}
        storeId={store.id}
      />
    </DashboardShell>
  );
}

async function DashboardOverview({
  currency,
  storeId
}: {
  currency: string;
  storeId: string;
}) {
  const [metrics, recentOrders, topProducts, lowStockProducts] = await Promise.all([
    getDashboardMetrics(storeId),
    getRecentOrders(storeId),
    getTopProducts(storeId),
    getLowStockProducts(storeId)
  ]);
  return (
    <section className="mx-auto grid max-w-[1480px] gap-4" aria-label="Dashboard overview">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(290px,0.95fr)]">
        <DashboardCard action={<span className="rounded-md border border-[#ececf5] px-3 py-1.5 text-[10px] text-[#555662]">Live overview</span>} title="Stats">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard index={0} label="Today Revenue" value={formatMoney(metrics.todayRevenue, currency)} />
            <MetricCard index={1} label="Month Revenue" value={formatMoney(metrics.thisMonthRevenue, currency)} />
            <MetricCard index={2} label="Total Orders" value={formatNumber(metrics.totalOrders)} />
            <MetricCard index={3} label="Pending Orders" value={formatNumber(metrics.pendingOrders)} />
            <MetricCard index={4} label="Total Products" value={formatNumber(metrics.totalProducts)} />
            <MetricCard index={5} label="Low Stock" value={formatNumber(metrics.lowStockProducts)} />
          </div>
        </DashboardCard>
        <SetupStatus hasOrders={metrics.totalOrders > 0} hasProducts={metrics.totalProducts > 0} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.15fr)]">
        <RecentSales orders={recentOrders} />
        <AbandonedCarts />
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)_minmax(260px,0.75fr)]">
        <RecentOrders currency={currency} orders={recentOrders} />
        <LowStockProducts products={lowStockProducts} />
        <TopProducts currency={currency} products={topProducts} />
      </div>
    </section>
  );
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en").format(value);
}
