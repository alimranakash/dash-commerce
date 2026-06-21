import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { requireUser } from "../../lib/auth";
import { LowStockProducts } from "../../modules/analytics/components/low-stock-products";
import { MetricCard } from "../../modules/analytics/components/metric-card";
import { QuickActions } from "../../modules/analytics/components/quick-actions";
import { RecentOrders } from "../../modules/analytics/components/recent-orders";
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
        storeId={store.id}
        storeSlug={store.slug}
        userName={user.name ?? user.email ?? "seller"}
      />
    </DashboardShell>
  );
}

async function DashboardOverview({
  storeId,
  storeSlug,
  userName
}: {
  storeId: string;
  storeSlug: string;
  userName: string;
}) {
  const [metrics, recentOrders, topProducts, lowStockProducts] = await Promise.all([
    getDashboardMetrics(storeId),
    getRecentOrders(storeId),
    getTopProducts(storeId),
    getLowStockProducts(storeId)
  ]);
  const currency = recentOrders[0]?.currency ?? "BDT";

  return (
    <section className="resource-page dashboard-overview-page" aria-labelledby="dashboard-title">
      <div className="dashboard-overview-hero">
        <div>
          <p className="eyebrow">Seller dashboard</p>
          <h1 id="dashboard-title">Welcome, {userName}</h1>
          <p className="auth-copy">
            Monitor sales, orders, inventory signals, and fast next actions from one place.
          </p>
        </div>
      </div>
      <div className="analytics-metric-grid">
        <MetricCard
          helper="Non-cancelled orders"
          label="Today revenue"
          value={formatMoney(metrics.todayRevenue, currency)}
        />
        <MetricCard
          helper="Current calendar month"
          label="This month revenue"
          value={formatMoney(metrics.thisMonthRevenue, currency)}
        />
        <MetricCard label="Total orders" value={formatNumber(metrics.totalOrders)} />
        <MetricCard helper="Pending or confirmed" label="Pending orders" value={formatNumber(metrics.pendingOrders)} />
        <MetricCard label="Total products" value={formatNumber(metrics.totalProducts)} />
        <MetricCard
          helper="At or below threshold"
          label="Low stock products"
          value={formatNumber(metrics.lowStockProducts)}
        />
      </div>
      {metrics.totalOrders === 0 && metrics.totalProducts === 0 ? (
        <div className="empty-state dashboard-empty-state">
          <h2>Your command center is ready</h2>
          <p>Add products and open your storefront to start collecting analytics from real orders.</p>
        </div>
      ) : null}
      <QuickActions storeSlug={storeSlug} />
      <div className="analytics-content-grid">
        <RecentOrders currency={currency} orders={recentOrders} />
        <div className="analytics-side-stack">
          <TopProducts currency={currency} products={topProducts} />
          <LowStockProducts products={lowStockProducts} />
        </div>
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
