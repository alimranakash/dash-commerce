"use client";

import { Button } from "@dash/ui";
import { Eye, Search, ShieldCheck, ShieldOff, Trash2, UserCheck, UserX, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import {
  activateAdminUserAction,
  deleteAdminUserAction,
  makeUserAdminAction,
  removeUserAdminAction,
  suspendAdminUserAction
} from "../admin-users.actions";

export type AdminUserListItem = {
  createdAt: string;
  email: string;
  emailVerified: boolean;
  id: string;
  image?: string | null;
  isCurrentAdmin: boolean;
  isSuspended: boolean;
  joinedStores: Array<{
    name: string;
    role: string;
    slug: string;
    status: string;
  }>;
  lastActivity: string;
  loginProviders: string[];
  name: string;
  phone: string | null;
  phoneVerified: boolean;
  role: "ADMIN" | "MEMBER" | "OWNER";
  storesCount: number;
};

type AdminUserManagementProps = {
  activeRole: string;
  activeStatus: string;
  search: string;
  users: AdminUserListItem[];
};

const roleOptions = [
  { label: "All", value: "all" },
  { label: "Admin", value: "admin" },
  { label: "Seller", value: "seller" }
];

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" }
];

export function AdminUserManagement({ activeRole, activeStatus, search, users }: AdminUserManagementProps) {
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUserListItem | null>(null);
  const [pending, startTransition] = useTransition();
  const hasUsers = users.length > 0;
  const filterLabel = useMemo(() => {
    const role = roleOptions.find((option) => option.value === activeRole)?.label ?? "All";
    const status = statusOptions.find((option) => option.value === activeStatus)?.label ?? "All";
    return `${role} / ${status}`;
  }, [activeRole, activeStatus]);

  function runAction(action: (userId: string) => Promise<void>, userId: string, onDone?: () => void) {
    startTransition(async () => {
      await action(userId);
      onDone?.();
    });
  }

  return (
    <>
      <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Users</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">Showing {filterLabel.toLowerCase()} users.</p>
          </div>

          <DashboardQueryForm actionPath="/admin/users" className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_130px_150px_44px] xl:w-[680px]">
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={search}
              name="search"
              placeholder="Search name or email"
              type="search"
            />
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeRole} name="role">
              {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeStatus} name="status">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button aria-label="Search users" className="grid h-11 place-items-center rounded-lg bg-[#7c3aed] text-white hover:bg-[#6d28d9]" type="submit">
              <Search className="h-4 w-4" />
            </button>
          </DashboardQueryForm>
        </div>

        {hasUsers ? (
          <div className="overflow-hidden rounded-xl border border-[#efeff5] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
                <thead className="bg-[#f7f7fa] text-[#565762]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">User</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold">Stores</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Joined</th>
                    <th className="px-4 py-3 font-semibold">Last Activity</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efeff5]">
                  {users.map((user) => (
                    <tr className="transition hover:bg-[#fbfaff]" key={user.id}>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-[#f3f0ff] text-[#6d3cf5]">
                            {user.image ? <img alt={user.name} className="h-full w-full object-cover" src={user.image} /> : user.name.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <div className="font-semibold text-[#20212c]">{user.name}</div>
                            {user.isCurrentAdmin ? <div className="mt-1 text-[11px] text-[#7c3aed]">Current admin</div> : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-[#565762]">{user.email}</td>
                      <td className="px-4 py-4"><RoleBadge role={user.role} /></td>
                      <td className="px-4 py-4">{user.storesCount}</td>
                      <td className="px-4 py-4"><UserStatusBadge suspended={user.isSuspended} /></td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{user.createdAt}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{user.lastActivity}</td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1.5">
                          <button className="grid h-8 w-8 place-items-center rounded-lg text-[#6d3cf5] hover:bg-[#f3f0ff]" onClick={() => setSelectedUser(user)} title="View user" type="button">
                            <Eye className="h-4 w-4" />
                          </button>
                          {user.role === "ADMIN" ? (
                            <button className="grid h-8 w-8 place-items-center rounded-lg text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={pending || user.isCurrentAdmin} onClick={() => runAction(removeUserAdminAction, user.id)} title="Remove admin" type="button">
                              <ShieldOff className="h-4 w-4" />
                            </button>
                          ) : (
                            <button className="grid h-8 w-8 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50" disabled={pending} onClick={() => runAction(makeUserAdminAction, user.id)} title="Make admin" type="button">
                              <ShieldCheck className="h-4 w-4" />
                            </button>
                          )}
                          {user.isSuspended ? (
                            <button className="grid h-8 w-8 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50" disabled={pending} onClick={() => runAction(activateAdminUserAction, user.id)} title="Activate user" type="button">
                              <UserCheck className="h-4 w-4" />
                            </button>
                          ) : (
                            <button className="grid h-8 w-8 place-items-center rounded-lg text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={pending || user.isCurrentAdmin} onClick={() => runAction(suspendAdminUserAction, user.id)} title="Suspend user" type="button">
                              <UserX className="h-4 w-4" />
                            </button>
                          )}
                          <button className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40" disabled={pending || user.isCurrentAdmin} onClick={() => setDeleteTarget(user)} title="Delete user" type="button">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <AdminUsersEmpty />
        )}
      </section>

      {selectedUser ? <UserDetailsModal onClose={() => setSelectedUser(null)} user={selectedUser} /> : null}
      {deleteTarget ? (
        <DeleteUserModal
          disabled={pending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => runAction(deleteAdminUserAction, deleteTarget.id, () => setDeleteTarget(null))}
          user={deleteTarget}
        />
      ) : null}
    </>
  );
}

function RoleBadge({ role }: { role: AdminUserListItem["role"] }) {
  const isAdmin = role === "ADMIN";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${isAdmin ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-blue-50 text-blue-700 ring-blue-100"}`}>
      {isAdmin ? "Admin" : "Seller"}
    </span>
  );
}

function UserStatusBadge({ suspended }: { suspended: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${suspended ? "bg-red-50 text-red-700 ring-red-100" : "bg-emerald-50 text-emerald-700 ring-emerald-100"}`}>
      {suspended ? "Suspended" : "Active"}
    </span>
  );
}

function UserDetailsModal({ onClose, user }: { onClose: () => void; user: AdminUserListItem }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[100] flex justify-end bg-[#20212a]/45" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#efeff5] pb-4">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">User Details</p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-[#20212c]">{user.name}</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">{user.email}</p>
          </div>
          <button className="grid h-9 w-9 place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4">
          <DetailSection title="User Information">
            <DetailRow label="Name" value={user.name} />
            <DetailRow
              label="Email"
              note={user.email === "No email" ? undefined : { ok: user.emailVerified, text: user.emailVerified ? "Verified" : "Unverified" }}
              value={user.email}
            />
            <DetailRow
              label="Phone"
              note={user.phone === null ? undefined : { ok: user.phoneVerified, text: user.phoneVerified ? "Verified" : "Unverified" }}
              value={user.phone ?? "No phone"}
            />
            <DetailRow label="Created Date" value={user.createdAt} />
            <DetailRow label="Last Activity" value={user.lastActivity} />
          </DetailSection>
          <DetailSection title="Role & Status">
            <div className="flex flex-wrap gap-2">
              <RoleBadge role={user.role} />
              <UserStatusBadge suspended={user.isSuspended} />
            </div>
          </DetailSection>
          <DetailSection title="Login Provider">
            <p className="m-0 text-sm text-[#30313d]">{user.loginProviders.length ? user.loginProviders.join(", ") : "Email credentials"}</p>
          </DetailSection>
          <DetailSection title="Stores owned/member of">
            {user.joinedStores.length ? (
              <div className="space-y-2">
                {user.joinedStores.map((store) => (
                  <div className="rounded-lg bg-white p-3" key={`${store.slug}-${store.role}`}>
                    <div className="font-semibold text-[#20212c]">{store.name}</div>
                    <div className="mt-1 text-xs text-[#74758a]">{store.role} · {store.slug}.dash.com · {store.status}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="m-0 text-sm text-[#74758a]">No stores connected to this user.</p>
            )}
          </DetailSection>
        </div>
      </aside>
    </div>
  );
}

function DeleteUserModal({
  disabled,
  onClose,
  onConfirm,
  user
}: {
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
  user: AdminUserListItem;
}) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[110] grid place-items-center bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <Trash2 className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-center text-xl font-semibold text-[#20212c]">Delete User</h2>
        <p className="mt-2 text-center text-sm leading-6 text-[#74758a]">
          Are you sure you want to delete {user.name}? This action removes the user account and cannot be undone.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="h-11 rounded-lg border border-[#dedcf0] font-semibold text-[#30313d] hover:bg-[#f7f5ff]" disabled={disabled} onClick={onClose} type="button">Cancel</button>
          <Button className="h-11 rounded-lg bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-60" disabled={disabled} onClick={onConfirm} type="button">
            {disabled ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailSection({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-[#efeff5] bg-[#fbfaff] p-4">
      <h3 className="m-0 text-sm font-semibold text-[#20212c]">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DetailRow({ label, note, value }: { label: string; note?: { ok: boolean; text: string } | undefined; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#efeff5] py-2 last:border-b-0">
      <span className="text-xs font-medium text-[#74758a]">{label}</span>
      <span className="text-right text-xs font-semibold text-[#30313d]">
        {value}
        {note ? <em className={`ml-2 not-italic font-semibold ${note.ok ? "text-[#1f9d6a]" : "text-[#c08a2b]"}`}>{note.text}</em> : null}
      </span>
    </div>
  );
}

function AdminUsersEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
        <UserCheck className="h-6 w-6" />
      </div>
      <h3 className="m-0 text-lg font-semibold text-[#20212c]">No users found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74758a]">Users matching your search and filters will appear here.</p>
    </div>
  );
}
