import Link from "next/link";
import { Ban, CheckCircle2, ShieldAlert, ShieldQuestion } from "lucide-react";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { FakeOrderEmpty } from "../../../../modules/fake-orders/components/fake-order-empty";
import { FakeOrderSummaryCard } from "../../../../modules/fake-orders/components/fake-order-summary-card";
import { RiskLevelBadge, VerificationStatusBadge } from "../../../../modules/fake-orders/components/fake-order-badges";
import { getFakeOrderDashboard } from "../../../../modules/fake-orders/fake-order.service";
import type { FakeOrderFilter, VerificationStatus } from "../../../../modules/fake-orders/fake-order.types";
import { requireStore } from "../../../../modules/stores/queries";

type FakeOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const tabs: Array<{ key: FakeOrderFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "high", label: "High Risk" },
  { key: "medium", label: "Medium Risk" },
  { key: "low", label: "Low Risk" },
  { key: "verified", label: "Verified" }
];

export default async function FakeOrdersPage({ searchParams }: FakeOrdersPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const activeFilter = parseFilter(singleValue(params.risk));
  const search = singleValue(params.search).trim();
  const data = await getFakeOrderDashboard(store.id, activeFilter, search);
  const counts: Record<FakeOrderFilter, number> = {
    all: data.metrics.allOrders,
    high: data.metrics.highRiskOrders,
    low: data.metrics.lowRiskOrders,
    medium: data.metrics.mediumRiskOrders,
    verified: data.metrics.verifiedOrders
  };

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Orders</p>
            <h1>Fake Orders</h1>
            <p className="auth-copy">Review suspicious orders using rule-based risk signals from your store data.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/orders/verification">
            Verification Queue
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <FakeOrderSummaryCard icon={<ShieldAlert className="h-4 w-4" />} label="High Risk Orders" value={data.metrics.highRiskOrders.toString()} tone="red" />
          <FakeOrderSummaryCard icon={<ShieldQuestion className="h-4 w-4" />} label="Medium Risk Orders" value={data.metrics.mediumRiskOrders.toString()} tone="amber" />
          <FakeOrderSummaryCard icon={<CheckCircle2 className="h-4 w-4" />} label="Verified Orders" value={data.metrics.verifiedOrders.toString()} tone="green" />
          <FakeOrderSummaryCard icon={<Ban className="h-4 w-4" />} label="Blocked Customers" value={data.metrics.blockedCustomers.toString()} tone="purple" />
        </div>

        <div className="panel-card p-4 sm:p-5">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2 border-b border-[#ececf5]">
              {tabs.map((tab) => (
                <Link
                  className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-1 pb-2 text-sm font-medium transition ${activeFilter === tab.key ? "border-[#7c3aed] text-[#6d3cf5]" : "border-transparent text-[#30313d] hover:text-[#6d3cf5]"}`}
                  href={tab.key === "all" ? "/dashboard/orders/fake" : `/dashboard/orders/fake?risk=${tab.key}`}
                  key={tab.key}
                >
                  {tab.label}
                  <span className="rounded-full bg-[#f0eef8] px-2 py-0.5 text-[11px] text-[#565762]">{counts[tab.key]}</span>
                </Link>
              ))}
            </div>
            <form className="flex w-full gap-2 sm:max-w-md" method="get">
              <input name="risk" type="hidden" value={activeFilter === "all" ? "" : activeFilter} />
              <input className="h-11 min-w-0 flex-1 rounded-lg border border-[#e4e3ee] px-3 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={search} name="search" placeholder="Search order, customer, or phone" />
              <button className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white" type="submit">Search</button>
            </form>
          </div>

          {data.orders.length ? (
            <div className="overflow-hidden rounded-xl border border-[#efeff5] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-left text-xs">
                  <thead className="bg-[#f7f7fa] text-[#565762]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Order ID</th>
                      <th className="px-4 py-3 font-semibold">Customer</th>
                      <th className="px-4 py-3 font-semibold">Phone</th>
                      <th className="px-4 py-3 font-semibold">Order Value</th>
                      <th className="px-4 py-3 font-semibold">Risk Score</th>
                      <th className="px-4 py-3 font-semibold">Risk Level</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Created At</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efeff5]">
                    {data.orders.map(({ assessment, order }) => (
                      <tr className="transition hover:bg-[#fbfaff]" key={order.id}>
                        <td className="px-4 py-4 font-semibold text-[#20212c]">{order.orderNumber}</td>
                        <td className="px-4 py-4 text-[#30313d]">{order.customerName}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{order.customerPhone}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#30313d]">{formatMoney(order.totalAmount, order.currency)}</td>
                        <td className="px-4 py-4 font-semibold text-[#20212c]">{assessment.score}/100</td>
                        <td className="px-4 py-4"><RiskLevelBadge level={assessment.level} /></td>
                        <td className="px-4 py-4"><VerificationStatusBadge status={order.verificationStatus as VerificationStatus} /></td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{formatDate(order.createdAt)}</td>
                        <td className="px-4 py-4 text-right">
                          <Link className="inline-flex h-8 items-center rounded-lg border border-[#ddd6fe] px-3 text-xs font-semibold text-[#6d3cf5] hover:bg-[#f3f0ff]" href={`/dashboard/orders/fake/${order.id}`}>
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <FakeOrderEmpty title="No fake orders found" description="Orders matching this risk filter will appear here once detected." />
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

function parseFilter(value: string): FakeOrderFilter {
  const allowed: FakeOrderFilter[] = ["all", "high", "medium", "low", "verified"];
  return allowed.includes(value as FakeOrderFilter) ? value as FakeOrderFilter : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(value);
}
