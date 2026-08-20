import { BadgeDollarSign, CheckCircle2, Sparkles, Timer } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "../../../components/admin/admin-ui";
import { AdminPlanManagement, type AdminPlanListItem } from "../../../modules/admin/components/admin-plan-management";
import { getAdminPlanMetrics, getAdminPlans } from "../../../modules/admin/admin-plans.service";

type AdminPlansPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPlansPage({ searchParams }: AdminPlansPageProps) {
  const params = await searchParams;
  const rawSearch = singleValue(params.search).trim();
  const search = rawSearch.toLowerCase();
  const [metrics, plans] = await Promise.all([getAdminPlanMetrics(), getAdminPlans()]);
  const filteredPlans = search
    ? plans.filter((plan) =>
        [plan.name, plan.slug, plan.description ?? "", plan.currency]
          .join(" ")
          .toLowerCase()
          .includes(search)
      )
    : plans;

  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Prepare subscription plans, pricing tiers, and feature limits." title="Plans" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard icon={<BadgeDollarSign className="h-4 w-4" />} label="Total Plans" value={metrics.totalPlans.toString()} />
        <AdminMetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Active Plans" value={metrics.activePlans.toString()} tone="green" />
        <AdminMetricCard icon={<Sparkles className="h-4 w-4" />} label="Featured Plan" value={metrics.featuredPlan} tone="purple" />
        <AdminMetricCard icon={<Timer className="h-4 w-4" />} label="Free Trial Days" value={metrics.freeTrialDays.toString()} tone="blue" />
      </div>
      <AdminPlanManagement plans={filteredPlans.map(toPlanListItem)} search={rawSearch} />
    </section>
  );
}

type AdminPlanRecord = Awaited<ReturnType<typeof getAdminPlans>>[number];

function toPlanListItem(plan: AdminPlanRecord): AdminPlanListItem {
  return {
    aiEnabled: plan.aiEnabled,
    currency: plan.currency,
    customDomainEnabled: plan.customDomainEnabled,
    customerLimit: plan.customerLimit,
    description: plan.description,
    id: plan.id,
    isActive: plan.isActive,
    isFeatured: plan.isFeatured,
    name: plan.name,
    orderLimit: plan.orderLimit,
    posEnabled: plan.posEnabled,
    priceMonthly: plan.priceMonthly.toString(),
    priceYearly: plan.priceYearly.toString(),
    productLimit: plan.productLimit,
    slug: plan.slug,
    sortOrder: plan.sortOrder,
    smsLimit: plan.smsLimit,
    staffLimit: plan.staffLimit,
    storeLimit: plan.storeLimit,
    trialDays: plan.trialDays
  };
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}
