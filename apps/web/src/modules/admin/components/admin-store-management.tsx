"use client";

import { Button } from "@dash/ui";
import { Eye, Power, Search, ShieldAlert, Store, Trash2, UserCog, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import {
  activateAdminStoreAction,
  archiveAdminStoreAction,
  suspendAdminStoreAction
} from "../admin-stores.actions";

export type AdminStoreTeamMember = {
  email: string;
  joinedAt: string;
  name: string;
  role: string;
};

export type AdminStoreListItem = {
  createdAt: string;
  customersCount: number;
  domain: string;
  id: string;
  lastActivity: string;
  name: string;
  ordersCount: number;
  organizationName: string;
  ownerEmail: string;
  ownerImage?: string | null;
  ownerName: string;
  plan: string;
  productsCount: number;
  slug: string;
  /** `null` when the plan is unlimited, matching the `0 = unlimited` convention. */
  staffLimit: number | null;
  status: "ACTIVE" | "DRAFT" | "SUSPENDED";
  storeUrl: string;
  team: AdminStoreTeamMember[];
};

type AdminStoreManagementProps = {
  activeStatus: string;
  search: string;
  stores: AdminStoreListItem[];
};

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Trial", value: "trial" },
  { label: "Suspended", value: "suspended" }
];

export function AdminStoreManagement({ activeStatus, search, stores }: AdminStoreManagementProps) {
  const [selectedStore, setSelectedStore] = useState<AdminStoreListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminStoreListItem | null>(null);
  const [pending, startTransition] = useTransition();
  const hasStores = stores.length > 0;
  const statusLabel = useMemo(
    () => statusOptions.find((option) => option.value === activeStatus)?.label ?? "All",
    [activeStatus]
  );

  function runAction(
    action: (storeId: string) => Promise<void>,
    storeId: string,
    onDone?: () => void
  ) {
    startTransition(async () => {
      await action(storeId);
      onDone?.();
    });
  }

  return (
    <>
      <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Stores</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">
              Showing {statusLabel.toLowerCase()} stores across the platform.
            </p>
          </div>

          <DashboardQueryForm
            actionPath="/admin/stores"
            className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_160px_44px] xl:w-[560px]"
          >
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={search}
              name="search"
              placeholder="Search store, owner, email, domain"
              type="search"
            />
            <select
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={activeStatus}
              name="status"
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              aria-label="Search stores"
              className="grid h-11 place-items-center rounded-lg bg-[#7c3aed] text-white hover:bg-[#6d28d9]"
              type="submit"
            >
              <Search className="h-4 w-4" />
            </button>
          </DashboardQueryForm>
        </div>

        {hasStores ? (
          <div className="overflow-hidden rounded-xl border border-[#efeff5] bg-white">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
                <thead className="bg-[#f7f7fa] text-[#565762]">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Store</th>
                    <th className="px-4 py-3 font-semibold">Owner</th>
                    <th className="px-4 py-3 font-semibold">Plan</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Products</th>
                    <th className="px-4 py-3 font-semibold">Orders</th>
                    <th className="px-4 py-3 font-semibold">Created</th>
                    <th className="px-4 py-3 font-semibold">Last Activity</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#efeff5]">
                  {stores.map((store) => (
                    <tr className="transition hover:bg-[#fbfaff]" key={store.id}>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#20212c]">{store.name}</div>
                        <div className="mt-1 text-[11px] text-[#74758a]">{store.domain}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-[#30313d]">{store.ownerName}</div>
                        <div className="mt-1 text-[11px] text-[#74758a]">{store.ownerEmail}</div>
                      </td>
                      <td className="px-4 py-4">{store.plan}</td>
                      <td className="px-4 py-4">
                        <StoreStatusBadge status={store.status} />
                      </td>
                      <td className="px-4 py-4">{store.productsCount}</td>
                      <td className="px-4 py-4">{store.ordersCount}</td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#565762]">
                        {store.createdAt}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 text-[#565762]">
                        {store.lastActivity}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex justify-end gap-1.5">
                          <button
                            className="grid h-8 w-8 place-items-center rounded-lg text-[#6d3cf5] hover:bg-[#f3f0ff]"
                            onClick={() => setSelectedStore(store)}
                            title="View details"
                            type="button"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <Link
                            className="grid h-8 w-8 place-items-center rounded-lg text-[#2563eb] hover:bg-blue-50"
                            href={store.storeUrl}
                            target="_blank"
                            title="View store"
                          >
                            <Store className="h-4 w-4" />
                          </Link>
                          <button
                            className="grid h-8 w-8 place-items-center rounded-lg text-[#7c3aed] hover:bg-[#f3f0ff]"
                            onClick={() => setSelectedStore(store)}
                            title="Impersonate placeholder"
                            type="button"
                          >
                            <UserCog className="h-4 w-4" />
                          </button>
                          {store.status === "SUSPENDED" ? (
                            <button
                              className="grid h-8 w-8 place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50"
                              disabled={pending}
                              onClick={() => runAction(activateAdminStoreAction, store.id)}
                              title="Activate"
                              type="button"
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              className="grid h-8 w-8 place-items-center rounded-lg text-amber-700 hover:bg-amber-50"
                              disabled={pending}
                              onClick={() => runAction(suspendAdminStoreAction, store.id)}
                              title="Suspend"
                              type="button"
                            >
                              <ShieldAlert className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteTarget(store)}
                            title="Delete"
                            type="button"
                          >
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
          <AdminStoresEmpty />
        )}
      </section>

      {selectedStore ? (
        <StoreDetailsModal onClose={() => setSelectedStore(null)} store={selectedStore} />
      ) : null}
      {deleteTarget ? (
        <DeleteStoreModal
          disabled={pending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() =>
            runAction(archiveAdminStoreAction, deleteTarget.id, () => setDeleteTarget(null))
          }
          store={deleteTarget}
        />
      ) : null}
    </>
  );
}

function StoreStatusBadge({ status }: { status: AdminStoreListItem["status"] }) {
  const styles = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    DRAFT: "bg-amber-50 text-amber-700 ring-amber-100",
    SUSPENDED: "bg-red-50 text-red-700 ring-red-100"
  }[status];

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}
    >
      {status === "DRAFT" ? "Trial" : titleCase(status)}
    </span>
  );
}

function StoreDetailsModal({ onClose, store }: { onClose: () => void; store: AdminStoreListItem }) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[100] flex justify-end bg-[#20212a]/45"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
    >
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#efeff5] pb-4">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">
              Store Details
            </p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-[#20212c]">{store.name}</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">{store.domain}</p>
          </div>
          <button
            className="grid h-9 w-9 place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4">
          <DetailSection title="Store Information">
            <DetailRow label="Store Name" value={store.name} />
            <DetailRow label="Organization" value={store.organizationName} />
            <DetailRow label="Store URL" value={store.storeUrl} />
            <DetailRow label="Created Date" value={store.createdAt} />
            <DetailRow label="Last Activity" value={store.lastActivity} />
          </DetailSection>
          <DetailSection title="Owner Information">
            <DetailRow label="Owner" value={store.ownerName} />
            <DetailRow label="Email" value={store.ownerEmail} />
          </DetailSection>
          <DetailSection title="Current Plan">
            <DetailRow label="Plan" value={store.plan} />
            <div className="mt-3">
              <StoreStatusBadge status={store.status} />
            </div>
          </DetailSection>
          <DetailSection title="Statistics">
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="Products" value={store.productsCount.toString()} />
              <Stat label="Orders" value={store.ordersCount.toString()} />
              <Stat label="Customers" value={store.customersCount.toString()} />
            </div>
          </DetailSection>
          <DetailSection
            title={`Team (${store.team.length}${store.staffLimit === null ? "" : ` of ${store.staffLimit}`})`}
          >
            {/* Seats here count members only. Pending invites hold a seat in the
                seller's own view, but support is looking at who can actually
                sign in right now. */}
            <div className="grid gap-2">
              {store.team.map((member) => (
                <div
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-[#eeecf7] bg-[#fbfaff] px-3 py-2"
                  key={member.email}
                >
                  <div>
                    <div className="text-xs font-semibold text-[#30313d]">{member.name}</div>
                    <div className="mt-0.5 text-[11px] text-[#74758a]">{member.email}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-[#6d3cf5]">
                      {member.role}
                    </div>
                    <div className="mt-0.5 text-[11px] text-[#8a8b99]">
                      joined {member.joinedAt}
                    </div>
                  </div>
                </div>
              ))}
              {store.staffLimit !== null && store.team.length > store.staffLimit ? (
                <p className="m-0 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-3 py-2 text-[11px] text-[#8a6134]">
                  This team is over what its plan allows. Nobody is removed automatically — the
                  store simply cannot add anyone else.
                </p>
              ) : null}
            </div>
          </DetailSection>
          <DetailSection title="Actions">
            <div className="flex flex-wrap gap-2">
              <Link
                className="inline-flex h-9 items-center rounded-lg border border-[#ddd6fe] px-3 text-xs font-semibold text-[#6d3cf5] hover:bg-[#f3f0ff]"
                href={store.storeUrl}
                target="_blank"
              >
                View Store
              </Link>
              <button
                className="inline-flex h-9 items-center rounded-lg border border-[#ddd6fe] px-3 text-xs font-semibold text-[#6d3cf5] hover:bg-[#f3f0ff]"
                type="button"
              >
                Impersonate Store
              </button>
            </div>
          </DetailSection>
        </div>
      </aside>
    </div>
  );
}

function DeleteStoreModal({
  disabled,
  onClose,
  onConfirm,
  store
}: {
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
  store: AdminStoreListItem;
}) {
  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[110] grid place-items-center bg-[#20212a]/45 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <Trash2 className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-center text-xl font-semibold text-[#20212c]">Delete Store</h2>
        <p className="mt-2 text-center text-sm leading-6 text-[#74758a]">
          Are you sure you want to delete {store.name}? This will archive the store from admin
          views. Tenant data will not be permanently deleted.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className="h-11 rounded-lg border border-[#dedcf0] font-semibold text-[#30313d] hover:bg-[#f7f5ff]"
            disabled={disabled}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <Button
            className="h-11 rounded-lg bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-60"
            disabled={disabled}
            onClick={onConfirm}
            type="button"
          >
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#efeff5] py-2 last:border-b-0">
      <span className="text-xs font-medium text-[#74758a]">{label}</span>
      <span className="text-right text-xs font-semibold text-[#30313d]">{value}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 text-center">
      <strong className="block text-xl font-semibold text-[#20212c]">{value}</strong>
      <span className="text-[11px] text-[#74758a]">{label}</span>
    </div>
  );
}

function AdminStoresEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
        <Store className="h-6 w-6" />
      </div>
      <h3 className="m-0 text-lg font-semibold text-[#20212c]">No stores found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74758a]">
        Stores matching your search and filters will appear here.
      </p>
    </div>
  );
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
}
