import { CreditCard, Store, TrendingUp, Users } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "../../components/admin/admin-ui";
import { getAdminOverviewMetrics } from "../../modules/admin/admin.repository";

export default async function AdminOverviewPage() {
  const metrics = await getAdminOverviewMetrics();

  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader
        description="Monitor platform health, tenants, subscriptions, and operational signals from one place."
        title="Overview"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <AdminMetricCard icon={<Users className="h-4 w-4" />} label="Total Users" value={metrics.totalUsers.toString()} />
        <AdminMetricCard icon={<Store className="h-4 w-4" />} label="Total Stores" value={metrics.totalStores.toString()} tone="blue" />
        <AdminMetricCard icon={<TrendingUp className="h-4 w-4" />} label="Active Stores" value={metrics.activeStores.toString()} tone="green" />
        <AdminMetricCard icon={<Store className="h-4 w-4" />} label="Trial Stores" value={metrics.trialStores.toString()} tone="amber" />
        <AdminMetricCard icon={<CreditCard className="h-4 w-4" />} label="Paid Stores" value={metrics.paidStores.toString()} />
        <AdminMetricCard icon={<TrendingUp className="h-4 w-4" />} label="Total Revenue" value={metrics.totalRevenue} tone="green" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
          <h2 className="m-0 text-base font-semibold text-[#20212c]">Platform Activity</h2>
          <div className="mt-5 rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-10 text-center text-sm text-[#74758a]">
            Admin activity charts and tenant health events will appear here.
          </div>
        </section>
        <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
          <h2 className="m-0 text-base font-semibold text-[#20212c]">Admin Notes</h2>
          <div className="mt-4 space-y-3 text-sm text-[#565762]">
            <p className="m-0 rounded-lg bg-[#fbfaff] p-3">Billing, support, and audit log tools are scaffolded as admin placeholders.</p>
            <p className="m-0 rounded-lg bg-[#fbfaff] p-3">Access is limited to users with the platform `ADMIN` role.</p>
          </div>
        </section>
      </div>
    </section>
  );
}
