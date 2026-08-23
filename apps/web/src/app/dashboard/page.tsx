import { DashboardShell } from "../../components/dashboard/dashboard-shell";
import { DashboardCard } from "../../components/dashboard/dashboard-card";
import { requireUser } from "../../lib/auth";
import { listAbandonedCarts } from "../../modules/abandoned-carts/abandoned-cart.service";
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
import { getPlatformRootDomain } from "../../lib/host-routing";
import { OnboardingForm } from "../../modules/onboarding/onboarding-form";
import onboardingStyles from "../../modules/onboarding/onboarding-experience.module.css";
import { redirect } from "next/navigation";
import { isStoreLocked } from "../../modules/billing/free-trial";
import { getCurrentStore } from "../../modules/stores/queries";

export default async function DashboardPage() {
  const user = await requireUser();
  const store = await getCurrentStore();

  if (!store) {
    return (
      <main className={onboardingStyles.onboardingPage}>
        <header className={onboardingStyles.topbar}><span className={onboardingStyles.brand}><b>S</b> Store<i>IM</i></span><div><span>{user.name ?? user.email}</span><div className={onboardingStyles.logout}><LogoutButton /></div></div></header>
        <section className={onboardingStyles.onboardingShell} aria-labelledby="onboarding-title">
          <div className={onboardingStyles.pageIntro}><span>Workspace setup</span><h1 id="onboarding-title">Let’s build your commerce workspace.</h1><p>Five simple steps. No technical setup. You’ll be ready to add products and start selling in minutes.</p></div>
          <OnboardingForm platformDomain={getPlatformRootDomain()} />
        </section>
      </main>
    );
  }

  // The only dashboard page that reads the store without `requireStore()` — it
  // has to render onboarding when there is no store at all — so the free-year
  // lock is applied by hand here instead of being inherited from the guard.
  if (await isStoreLocked(store.id)) {
    redirect("/dashboard/billing");
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <DashboardOverview store={store} />
    </DashboardShell>
  );
}

async function DashboardOverview({
  store
}: {
  store: { currency: string; id: string; slug: string };
}) {
  const { currency, id: storeId } = store;
  const [metrics, recentOrders, topProducts, lowStockProducts, abandonedCarts] = await Promise.all([
    getDashboardMetrics(storeId),
    getRecentOrders(storeId),
    getTopProducts(storeId),
    getLowStockProducts(storeId),
    listAbandonedCarts(store, { limit: 5 })
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
        <AbandonedCarts carts={abandonedCarts} />
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
