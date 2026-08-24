import { CalendarPlus, ShieldCheck, Store, Users } from "lucide-react";
import { AdminMetricCard, AdminPageHeader } from "../../../components/admin/admin-ui";
import { requirePlatformAdmin } from "../../../modules/admin/admin.auth";
import {
  getAdminUserMetrics,
  getAdminUsers,
  type AdminUserRoleFilter,
  type AdminUserStatusFilter
} from "../../../modules/admin/admin-users.service";
import { formatAdminDateTime, getAdminTimeZone } from "../../../modules/admin/admin-datetime";
import { getPlatformRootDomain } from "../../../lib/host-routing";
import { AdminUserManagement, type AdminUserListItem } from "../../../modules/admin/components/admin-user-management";

type AdminUsersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminUsersPage({ searchParams }: AdminUsersPageProps) {
  const [admin, params] = await Promise.all([requirePlatformAdmin(), searchParams]);
  const search = singleValue(params.search).trim();
  const activeRole = parseRoleFilter(singleValue(params.role));
  const activeStatus = parseStatusFilter(singleValue(params.status));
  const [metrics, users, timeZone] = await Promise.all([
    getAdminUserMetrics(),
    getAdminUsers({
      role: activeRole,
      search,
      status: activeStatus
    }),
    // Every date on this page is rendered in the admin's own timezone rather
    // than the server's, which is UTC in production.
    getAdminTimeZone(admin.id)
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
        platformDomain={getPlatformRootDomain()}
        search={search}
        users={users.map((user) => toUserListItem(user, admin.id, timeZone))}
      />
    </section>
  );
}

type AdminUserRecord = Awaited<ReturnType<typeof getAdminUsers>>[number];

function toUserListItem(
  user: AdminUserRecord,
  currentAdminId: string,
  timeZone: string
): AdminUserListItem {
  const joinedStores = user.memberships.flatMap((membership) =>
    membership.organization.stores.map((store) => ({
      name: store.name,
      role: membership.role,
      slug: store.slug,
      status: store.status
    }))
  );

  return {
    // What identifies the account in a list: sellers who signed up with a phone
    // number have no email at all, and a row reading "No email" says nothing
    // about who they are.
    contact: user.email ?? user.phone ?? "No contact",
    createdAt: formatAdminDateTime(user.createdAt, timeZone),
    email: user.email,
    emailVerified: user.emailVerified !== null,
    id: user.id,
    image: user.image,
    isCurrentAdmin: user.id === currentAdminId,
    isSuspended: user.isSuspended,
    joinedStores,
    lastActivity: formatAdminDateTime(user.updatedAt, timeZone),
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

