import { CalendarPlus, ShieldCheck, Store, Users } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "../../../components/admin/admin-ui";
import { requirePlatformAdmin } from "../../../modules/admin/admin.auth";
import {
  getAdminUserMetrics,
  getAdminUsers,
  type AdminUserRoleFilter,
  type AdminUserStatusFilter
} from "../../../modules/admin/admin-users.service";
import { AdminUserManagement, type AdminUserListItem } from "../../../modules/admin/components/admin-user-management";

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const [admin, params] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const search = singleValue(params.search).trim();
  const activeRole = parseRoleFilter(singleValue(params.role));
  const activeStatus = parseStatusFilter(singleValue(params.status));
  const [metrics, users] = await Promise.all([
    getAdminUserMetrics(),
    getAdminUsers({
      role: activeRole,
      search,
      status: activeStatus
    })
  ]);

  return (
    <section className="mx-auto grid max-w-[1480px] gap-5">
      <AdminPageHeader description="Review platform users, roles, and access status." title="Users" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard icon={<Users className="h-4 w-4" />} label="Total Users" value={metrics.totalUsers.toString()} />
        <AdminMetricCard icon={<ShieldCheck className="h-4 w-4" />} label="Admin Users" value={metrics.adminUsers.toString()} tone="purple" />
        <AdminMetricCard icon={<Store className="h-4 w-4" />} label="Seller Users" value={metrics.sellerUsers.toString()} tone="blue" />
        <AdminMetricCard icon={<CalendarPlus className="h-4 w-4" />} label="New Users This Month" value={metrics.newUsersThisMonth.toString()} tone="green" />
      </div>
      <AdminUserManagement
        activeRole={activeRole}
        activeStatus={activeStatus}
        search={search}
        users={users.map((user) => toUserListItem(user, admin.id))}
      />
    </section>
  );
}

type AdminUserRecord = Awaited<ReturnType<typeof getAdminUsers>>[number];

function toUserListItem(user: AdminUserRecord, currentAdminId: string): AdminUserListItem {
  const joinedStores = user.memberships.flatMap((membership) =>
    membership.organization.stores.map((store) => ({
      name: store.name,
      role: membership.role,
      slug: store.slug,
      status: store.status
    }))
  );

  return {
    createdAt: formatDate(user.createdAt),
    email: user.email ?? "No email",
    emailVerified: user.emailVerified !== null,
    id: user.id,
    image: user.image,
    isCurrentAdmin: user.id === currentAdminId,
    isSuspended: user.isSuspended,
    joinedStores,
    lastActivity: formatDate(user.updatedAt),
    loginProviders: user.accounts.map((account) => account.provider),
    name: user.name ?? user.email ?? user.phone ?? "Unnamed user",
    phone: user.phone,
    phoneVerified: user.phoneVerified !== null,
    role: user.role,
    storesCount: joinedStores.length
  };
}

function parseRoleFilter(value: string): AdminUserRoleFilter {
  const filters: AdminUserRoleFilter[] = ["all", "admin", "seller"];
  return filters.includes(value as AdminUserRoleFilter) ? value as AdminUserRoleFilter : "all";
}

function parseStatusFilter(value: string): AdminUserStatusFilter {
  const filters: AdminUserStatusFilter[] = ["all", "active", "suspended"];
  return filters.includes(value as AdminUserStatusFilter) ? value as AdminUserStatusFilter : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
