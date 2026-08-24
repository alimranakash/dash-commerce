import { AlertCircle, Ban, CheckCircle2, FileClock, Timer } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "../../../components/admin/admin-ui";
import {
  getAdminSubscriptionMetrics,
  getAdminSubscriptionPlans,
  getAdminSubscriptions,
  type AdminSubscriptionBillingFilter,
  type AdminSubscriptionStatusFilter
} from "../../../modules/admin/admin-subscriptions.service";
import {
  AdminSubscriptionManagement,
  type AdminSubscriptionListItem,
  type AdminSubscriptionPlanOption
} from "../../../modules/admin/components/admin-subscription-management";
import { storeSubdomain } from "../../../lib/host-routing";

type AdminSubscriptionsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminSubscriptionsPage({ searchParams }: AdminSubscriptionsPageProps) {
  const params = await searchParams;
  const search = singleValue(params.search).trim();
  const activeStatus = parseStatusFilter(singleValue(params.status));
  const activeBillingCycle = parseBillingFilter(singleValue(params.billingCycle));
  const activePlanId = singleValue(params.planId) || "all";
  const [metrics, plans, subscriptions] = await Promise.all([
    getAdminSubscriptionMetrics(),
    getAdminSubscriptionPlans(),
    getAdminSubscriptions({
      billingCycle: activeBillingCycle,
      planId: activePlanId,
      search,
      status: activeStatus
    })
  ]);

  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Track tenant subscriptions, renewals, trials, and cancellations." title="Subscriptions" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <AdminMetricCard icon={<FileClock className="h-4 w-4" />} label="Total Subscriptions" value={metrics.totalSubscriptions.toString()} />
        <AdminMetricCard icon={<Timer className="h-4 w-4" />} label="Trialing" value={metrics.trialing.toString()} tone="blue" />
        <AdminMetricCard icon={<CheckCircle2 className="h-4 w-4" />} label="Active" value={metrics.active.toString()} tone="green" />
        <AdminMetricCard icon={<AlertCircle className="h-4 w-4" />} label="Past Due" value={metrics.pastDue.toString()} tone="amber" />
        <AdminMetricCard icon={<Ban className="h-4 w-4" />} label="Cancelled" value={metrics.cancelled.toString()} tone="purple" />
      </div>
      <AdminSubscriptionManagement
        activeBillingCycle={activeBillingCycle}
        activePlanId={activePlanId}
        activeStatus={activeStatus}
        plans={plans.map(toPlanOption)}
        search={search}
        subscriptions={subscriptions.map(toSubscriptionListItem)}
      />
    </section>
  );
}

type AdminSubscriptionRecord = Awaited<ReturnType<typeof getAdminSubscriptions>>[number];

function toSubscriptionListItem(subscription: AdminSubscriptionRecord): AdminSubscriptionListItem {
  const owner =
    subscription.organization.members.find((member) => member.role === "OWNER") ??
    subscription.organization.members[0];
  const trialDates = `${formatDate(subscription.trialStartsAt)} - ${formatDate(subscription.trialEndsAt)}`;
  const currentPeriod = `${formatDate(subscription.currentPeriodStartsAt)} - ${formatDate(subscription.currentPeriodEndsAt)}`;

  return {
    billingCycle: subscription.billingCycle,
    cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
    cancelledAt: formatDate(subscription.cancelledAt),
    createdAt: formatDate(subscription.createdAt),
    currentPeriod,
    id: subscription.id,
    ownerEmail: owner?.user.email ?? "No owner email",
    ownerImage: owner?.user.image ?? null,
    ownerName: owner?.user.name ?? "No owner assigned",
    paymentCount: subscription._count.payments,
    planId: subscription.planId,
    planName: subscription.plan.name,
    planSmsLimit: subscription.plan.smsLimit,
    smsLimitOverride: subscription.smsLimitOverride,
    status: subscription.status,
    storeArchived: subscription.store.status === "ARCHIVED",
    storeDomain: subscription.store.domains[0]?.domain ?? storeSubdomain(subscription.store.slug),
    storeName: subscription.store.name,
    storeSlug: subscription.store.slug,
    trialDates,
    trialEndsAt: formatDate(subscription.trialEndsAt)
  };
}

function toPlanOption(plan: Awaited<ReturnType<typeof getAdminSubscriptionPlans>>[number]): AdminSubscriptionPlanOption {
  return {
    id: plan.id,
    name: plan.name
  };
}

function parseStatusFilter(value: string): AdminSubscriptionStatusFilter {
  const filters: AdminSubscriptionStatusFilter[] = ["all", "active", "cancelled", "expired", "past_due", "trialing"];
  return filters.includes(value as AdminSubscriptionStatusFilter) ? value as AdminSubscriptionStatusFilter : "all";
}

function parseBillingFilter(value: string): AdminSubscriptionBillingFilter {
  const filters: AdminSubscriptionBillingFilter[] = ["all", "monthly", "yearly"];
  return filters.includes(value as AdminSubscriptionBillingFilter) ? value as AdminSubscriptionBillingFilter : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(date: Date | null) {
  if (!date) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(date);
}
