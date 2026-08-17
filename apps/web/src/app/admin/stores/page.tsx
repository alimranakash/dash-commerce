import { Activity, Ban, Store, TrendingUp } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "../../../components/admin/admin-ui";
import {
  AdminStoreManagement,
  type AdminStoreListItem
} from "../../../modules/admin/components/admin-store-management";
import {
  getAdminStoreMetrics,
  getAdminStores,
  type AdminStoreStatusFilter
} from "../../../modules/admin/admin-stores.service";

type AdminStoresPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminStoresPage({ searchParams }: AdminStoresPageProps) {
  const params = await searchParams;
  const search = singleValue(params.search).trim();
  const activeStatus = parseStatusFilter(singleValue(params.status));
  const [metrics, stores] = await Promise.all([
    getAdminStoreMetrics(),
    getAdminStores({
      search,
      status: activeStatus
    })
  ]);

  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader
        description="Monitor tenant stores, statuses, domains, and health."
        title="Stores"
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          icon={<Store className="h-4 w-4" />}
          label="Total Stores"
          value={metrics.totalStores.toString()}
        />
        <AdminMetricCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Active Stores"
          value={metrics.activeStores.toString()}
          tone="green"
        />
        <AdminMetricCard
          icon={<Ban className="h-4 w-4" />}
          label="Suspended Stores"
          value={metrics.suspendedStores.toString()}
          tone="amber"
        />
        <AdminMetricCard
          icon={<Activity className="h-4 w-4" />}
          label="Trial Stores"
          value={metrics.trialStores.toString()}
          tone="blue"
        />
      </div>
      <AdminStoreManagement
        activeStatus={activeStatus}
        search={search}
        stores={stores.map(toStoreListItem)}
      />
    </section>
  );
}

type AdminStoreRecord = Awaited<ReturnType<typeof getAdminStores>>[number];

function toStoreListItem(store: AdminStoreRecord): AdminStoreListItem {
  const owner =
    store.organization.members.find((member) => member.role === "OWNER") ??
    store.organization.members[0];
  const domain = store.domains[0]?.domain ?? `${store.slug}.dash.com`;
  const lastActivity = store.orders[0]?.updatedAt ?? store.updatedAt;
  const staffLimit = store.subscription?.plan.staffLimit;

  return {
    createdAt: formatDate(store.createdAt),
    customersCount: store._count.customers,
    domain,
    id: store.id,
    lastActivity: formatDate(lastActivity),
    name: store.name,
    ordersCount: store._count.orders,
    organizationName: store.organization.name,
    ownerEmail: owner?.user.email ?? "No owner email",
    ownerImage: owner?.user.image ?? null,
    ownerName: owner?.user.name ?? "No owner assigned",
    plan: store.subscription?.plan.name ?? planLabel(store.status),
    productsCount: store._count.products,
    slug: store.slug,
    // A store with no subscription row has no allowance to show; `0` on the plan
    // means unlimited. Both collapse to `null`, which the drawer renders as "no
    // limit shown" rather than inventing a number.
    staffLimit: !staffLimit || staffLimit <= 0 ? null : staffLimit,
    status: store.status as AdminStoreListItem["status"],
    storeUrl: `/s/${store.slug}`,
    team: store.organization.members.map((member) => ({
      email: member.user.email,
      joinedAt: formatDate(member.createdAt),
      name: member.user.name ?? "No name set",
      role: member.role
    }))
  };
}

function parseStatusFilter(value: string): AdminStoreStatusFilter {
  const filters: AdminStoreStatusFilter[] = ["all", "active", "trial", "suspended"];
  return filters.includes(value as AdminStoreStatusFilter)
    ? (value as AdminStoreStatusFilter)
    : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function planLabel(status: string) {
  if (status === "DRAFT") return "Trial";
  if (status === "SUSPENDED") return "Paused";
  return "Starter";
}
