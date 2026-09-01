"use client";

import { Button } from "@dash/ui";
import { CheckCircle2, Edit3, Plus, Search, Sparkles, Trash2, X, XCircle } from "lucide-react";
import { useActionState, useEffect, useState, useTransition, type InputHTMLAttributes, type ReactNode } from "react";
import { AdminMobileField } from "../../../components/admin/admin-ui";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import {
  activatePlanAction,
  createPlanAction,
  deactivatePlanAction,
  deletePlanAction,
  markPlanFeaturedAction,
  updatePlanAction,
  type PlanActionState
} from "../admin-plans.actions";

export type AdminPlanListItem = {
  aiEnabled: boolean;
  currency: string;
  customDomainEnabled: boolean;
  customerLimit: number;
  description: string | null;
  id: string;
  isActive: boolean;
  isFeatured: boolean;
  name: string;
  orderLimit: number;
  posEnabled: boolean;
  priceMonthly: string;
  priceYearly: string;
  productLimit: number;
  slug: string;
  sortOrder: number;
  smsLimit: number;
  staffLimit: number;
  storeLimit: number;
  trialDays: number;
};

type AdminPlanManagementProps = {
  plans: AdminPlanListItem[];
  search: string;
};

const initialActionState: PlanActionState = {
  status: "idle"
};

export function AdminPlanManagement({ plans, search }: AdminPlanManagementProps) {
  const [activeModal, setActiveModal] = useState<{ mode: "create"; plan?: undefined } | { mode: "edit"; plan: AdminPlanListItem } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminPlanListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasPlans = plans.length > 0;

  function runAction(action: (planId: string) => Promise<void>, planId: string, onDone?: () => void) {
    startTransition(async () => {
      await action(planId);
      onDone?.();
    });
  }

  function deletePlan(planId: string) {
    startTransition(async () => {
      const result = await deletePlanAction(planId);

      if (result.ok) {
        setDeleteError(null);
        setDeleteTarget(null);
        return;
      }

      setDeleteError(result.message);
      setDeleteTarget(null);
    });
  }

  /** Shared by the desktop row and the mobile card so the two cannot drift apart. */
  function planActions(plan: AdminPlanListItem) {
    return (
      <>
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#6d3cf5] hover:bg-[#f3f0ff]" onClick={() => setActiveModal({ mode: "edit", plan })} title="Edit plan" type="button">
          <Edit3 className="h-4 w-4" />
        </button>
        {plan.isActive ? (
          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-amber-700 hover:bg-amber-50" disabled={pending} onClick={() => runAction(deactivatePlanAction, plan.id)} title="Deactivate" type="button">
            <XCircle className="h-4 w-4" />
          </button>
        ) : (
          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50" disabled={pending} onClick={() => runAction(activatePlanAction, plan.id)} title="Activate" type="button">
            <CheckCircle2 className="h-4 w-4" />
          </button>
        )}
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#7c3aed] hover:bg-[#f3f0ff] disabled:cursor-not-allowed disabled:opacity-40" disabled={pending || plan.isFeatured} onClick={() => runAction(markPlanFeaturedAction, plan.id)} title="Mark featured" type="button">
          <Sparkles className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-red-600 hover:bg-red-50" onClick={() => { setDeleteError(null); setDeleteTarget(plan); }} title="Delete plan" type="button">
          <Trash2 className="h-4 w-4" />
        </button>
      </>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
        {deleteError ? (
          <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{deleteError}</p>
        ) : null}
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Plans</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">Manage platform pricing tiers, feature gates, and usage limits.</p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <DashboardQueryForm actionPath="/admin/plans" className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_44px]">
              <input
                className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
                defaultValue={search}
                name="search"
                placeholder="Search plans"
                type="search"
              />
              <button aria-label="Search plans" className="grid h-11 cursor-pointer place-items-center rounded-lg bg-[#7c3aed] text-white hover:bg-[#6d28d9]" type="submit">
                <Search className="h-4 w-4" />
              </button>
            </DashboardQueryForm>
            <Button className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-sm font-semibold text-white hover:bg-[#6d28d9]" onClick={() => setActiveModal({ mode: "create" })}>
              <Plus className="h-4 w-4" />
              Create Plan
            </Button>
          </div>
        </div>

        {hasPlans ? (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[#efeff5] bg-white lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1120px] border-collapse text-left text-xs">
                  <thead className="bg-[#f7f7fa] text-[#565762]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Plan</th>
                      <th className="px-4 py-3 font-semibold">Monthly Price</th>
                      <th className="px-4 py-3 font-semibold">Yearly Price</th>
                      <th className="px-4 py-3 font-semibold">Limits</th>
                      <th className="px-4 py-3 font-semibold">Features</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Featured</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efeff5]">
                    {plans.map((plan) => (
                      <tr className="transition hover:bg-[#fbfaff]" key={plan.id}>
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f3f0ff] text-[#6d3cf5]">
                              <Sparkles className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-[#20212c]">{plan.name}</div>
                              <div className="mt-1 text-[11px] text-[#74758a]">{plan.slug} · {plan.trialDays} day trial</div>
                              {plan.description ? <p className="m-0 mt-1 max-w-xs text-[11px] leading-5 text-[#74758a]">{plan.description}</p> : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-[#20212c]">{formatMoney(plan.priceMonthly, plan.currency)}</td>
                        <td className="px-4 py-4 font-semibold text-[#20212c]">{formatMoney(plan.priceYearly, plan.currency)}</td>
                        <td className="px-4 py-4">
                          <div className="grid gap-1 text-[11px] text-[#565762]">
                            <span>Products: {limitLabel(plan.productLimit)}</span>
                            <span>Orders / month: {limitLabel(plan.orderLimit)}</span>
                            <span>Customers: {limitLabel(plan.customerLimit)}</span>
                            <span>Staff: {limitLabel(plan.staffLimit)}</span>
                            <span>SMS / month: {limitLabel(plan.smsLimit)}</span>
                            <span>Stores: {limitLabel(plan.storeLimit)}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex max-w-[220px] flex-wrap gap-1.5">
                            <FeatureBadge enabled={plan.customDomainEnabled}>Custom Domain</FeatureBadge>
                            <FeatureBadge enabled={plan.aiEnabled}>AI</FeatureBadge>
                            <FeatureBadge enabled={plan.posEnabled}>POS</FeatureBadge>
                          </div>
                        </td>
                        <td className="px-4 py-4"><PlanStatusBadge active={plan.isActive} /></td>
                        <td className="px-4 py-4"><FeaturedBadge featured={plan.isFeatured} /></td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1.5">{planActions(plan)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 lg:hidden">
              {plans.map((plan) => (
                <article className="rounded-xl border border-[#efeff5] bg-white p-4" key={plan.id}>
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f3f0ff] text-[#6d3cf5]">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-[#20212c]">{plan.name}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[#74758a]">{plan.slug} · {plan.trialDays} day trial</div>
                    </div>
                  </div>
                  {plan.description ? <p className="m-0 mt-2 text-[11px] leading-5 text-[#74758a]">{plan.description}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <PlanStatusBadge active={plan.isActive} />
                    <FeaturedBadge featured={plan.isFeatured} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0eff5] pt-3">
                    <AdminMobileField label="Monthly" value={formatMoney(plan.priceMonthly, plan.currency)} />
                    <AdminMobileField label="Yearly" value={formatMoney(plan.priceYearly, plan.currency)} />
                    <AdminMobileField label="Products" value={limitLabel(plan.productLimit)} />
                    <AdminMobileField label="Orders / month" value={limitLabel(plan.orderLimit)} />
                    <AdminMobileField label="Customers" value={limitLabel(plan.customerLimit)} />
                    <AdminMobileField label="Staff" value={limitLabel(plan.staffLimit)} />
                    <AdminMobileField label="SMS / month" value={limitLabel(plan.smsLimit)} />
                    <AdminMobileField label="Stores" value={limitLabel(plan.storeLimit)} />
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#f0eff5] pt-3">
                    <FeatureBadge enabled={plan.customDomainEnabled}>Custom Domain</FeatureBadge>
                    <FeatureBadge enabled={plan.aiEnabled}>AI</FeatureBadge>
                    <FeatureBadge enabled={plan.posEnabled}>POS</FeatureBadge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#f0eff5] pt-3">{planActions(plan)}</div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <AdminPlansEmpty onCreate={() => setActiveModal({ mode: "create" })} />
        )}
      </section>

      {activeModal?.mode === "create" ? <PlanFormModal key="create-plan" mode="create" onClose={() => setActiveModal(null)} /> : null}
      {activeModal?.mode === "edit" ? <PlanFormModal key={`edit-${activeModal.plan.id}`} mode="edit" onClose={() => setActiveModal(null)} plan={activeModal.plan} /> : null}
      {deleteTarget ? (
        <DeletePlanModal
          disabled={pending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deletePlan(deleteTarget.id)}
          plan={deleteTarget}
        />
      ) : null}
    </>
  );
}

function PlanFormModal({ mode, onClose, plan }: { mode: "create" | "edit"; onClose: () => void; plan?: AdminPlanListItem }) {
  const action = mode === "create" ? createPlanAction : updatePlanAction.bind(null, plan?.id ?? "");
  const [state, formAction, isPending] = useActionState(action, initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state.status]);

  const title = mode === "create" ? "Create Plan" : `Edit ${plan?.name}`;

  return (
    <div aria-modal="true" className="fixed inset-0 z-[100] flex justify-center overflow-y-auto bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <form action={formAction} className="my-auto w-full max-w-4xl rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-[#efeff5] p-5">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">Admin Plans</p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-[#20212c]">{title}</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">Set pricing, limits, and feature availability for this plan.</p>
          </div>
          <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          <PlanField label="Name" name="name" defaultValue={plan?.name} error={state.fieldErrors?.name} />
          <PlanField label="Slug" name="slug" defaultValue={plan?.slug} error={state.fieldErrors?.slug} placeholder="growth" />
          <PlanField label="Monthly Price" name="priceMonthly" defaultValue={plan?.priceMonthly ?? "0.00"} error={state.fieldErrors?.priceMonthly} min="0" step="0.01" type="number" />
          <PlanField label="Yearly Price" name="priceYearly" defaultValue={plan?.priceYearly ?? "0.00"} error={state.fieldErrors?.priceYearly} min="0" step="0.01" type="number" />
          <PlanField label="Currency" name="currency" defaultValue={plan?.currency ?? "BDT"} error={state.fieldErrors?.currency} />
          <PlanField label="Trial Days" name="trialDays" defaultValue={plan?.trialDays ?? 0} error={state.fieldErrors?.trialDays} min="0" type="number" />
          <PlanField label="Product Limit" name="productLimit" defaultValue={plan?.productLimit ?? 0} error={state.fieldErrors?.productLimit} min="0" type="number" />
          <PlanField label="Order Limit / month" name="orderLimit" defaultValue={plan?.orderLimit ?? 0} error={state.fieldErrors?.orderLimit} min="0" type="number" />
          <PlanField label="Customer Limit" name="customerLimit" defaultValue={plan?.customerLimit ?? 0} error={state.fieldErrors?.customerLimit} min="0" type="number" />
          <PlanField label="Staff Limit" name="staffLimit" defaultValue={plan?.staffLimit ?? 1} error={state.fieldErrors?.staffLimit} min="0" type="number" />
          <PlanField label="SMS Limit / month" name="smsLimit" defaultValue={plan?.smsLimit ?? 0} error={state.fieldErrors?.smsLimit} min="0" type="number" />
          <PlanField label="Store Limit" name="storeLimit" defaultValue={plan?.storeLimit ?? 1} error={state.fieldErrors?.storeLimit} min="0" type="number" />
          <PlanField label="Sort Order" name="sortOrder" defaultValue={plan?.sortOrder ?? 0} error={state.fieldErrors?.sortOrder} min="0" type="number" />
          <label className="grid gap-2 lg:col-span-2">
            <span className="text-sm font-semibold text-[#20212c]">Description</span>
            <textarea
              className="min-h-24 rounded-lg border border-[#e5e3f1] bg-white px-3.5 py-3 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={plan?.description ?? ""}
              name="description"
              placeholder="Describe the plan for internal admin context."
            />
            {state.fieldErrors?.description ? <span className="text-xs font-medium text-red-600">{state.fieldErrors.description}</span> : null}
          </label>

          <div className="grid gap-3 rounded-xl border border-[#efeff5] bg-[#fbfaff] p-4 lg:col-span-2">
            <h3 className="m-0 text-sm font-semibold text-[#20212c]">Plan Features</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <PlanCheckbox defaultChecked={plan?.customDomainEnabled ?? false} label="Custom Domain" name="customDomainEnabled" />
              <PlanCheckbox defaultChecked={plan?.aiEnabled ?? false} label="Enable AI" name="aiEnabled" />
              <PlanCheckbox defaultChecked={plan?.posEnabled ?? false} label="Enable POS" name="posEnabled" />
              <PlanCheckbox defaultChecked={plan?.isActive ?? true} label="Active" name="isActive" />
              <PlanCheckbox defaultChecked={plan?.isFeatured ?? false} label="Featured" name="isFeatured" />
            </div>
          </div>
        </div>

        {state.message && state.status === "error" ? <p className="mx-5 mb-0 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.message}</p> : null}

        <div className="flex flex-col gap-3 border-t border-[#efeff5] p-5 sm:flex-row sm:justify-end">
          <button className="h-11 cursor-pointer rounded-lg border border-[#dedcf0] px-4 font-semibold text-[#30313d] hover:bg-[#f7f5ff]" disabled={isPending} onClick={onClose} type="button">Cancel</button>
          <Button className="h-11 cursor-pointer rounded-lg bg-[#7c3aed] px-5 font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60" disabled={isPending} type="submit">
            {isPending ? "Saving..." : mode === "create" ? "Create Plan" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function PlanField({
  defaultValue,
  error,
  label,
  name,
  placeholder,
  type = "text",
  ...props
}: {
  defaultValue?: number | string | undefined;
  error?: string | undefined;
  label: string;
  name: string;
  placeholder?: string | undefined;
  type?: string | undefined;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[#20212c]">{label}</span>
      <input
        className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
        defaultValue={defaultValue}
        name={name}
        placeholder={placeholder}
        type={type}
        {...props}
      />
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

function PlanCheckbox({ defaultChecked, label, name }: { defaultChecked: boolean; label: string; name: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#e8e6f3] bg-white px-3 py-2 text-sm font-medium text-[#30313d]">
      <input className="h-4 w-4 accent-[#7c3aed]" defaultChecked={defaultChecked} name={name} type="checkbox" />
      {label}
    </label>
  );
}

function DeletePlanModal({
  disabled,
  onClose,
  onConfirm,
  plan
}: {
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
  plan: AdminPlanListItem;
}) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[110] flex justify-center overflow-y-auto bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <div className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <Trash2 className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-center text-xl font-semibold text-[#20212c]">Delete Plan</h2>
        <p className="mt-2 text-center text-sm leading-6 text-[#74758a]">
          Are you sure you want to delete {plan.name}? This action cannot be undone.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="h-11 cursor-pointer rounded-lg border border-[#dedcf0] font-semibold text-[#30313d] hover:bg-[#f7f5ff]" disabled={disabled} onClick={onClose} type="button">Cancel</button>
          <Button className="h-11 cursor-pointer rounded-lg bg-red-600 font-semibold text-white hover:bg-red-700 disabled:opacity-60" disabled={disabled} onClick={onConfirm} type="button">
            {disabled ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FeatureBadge({ children, enabled }: { children: ReactNode; enabled: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${enabled ? "bg-violet-50 text-violet-700 ring-violet-100" : "bg-slate-50 text-slate-500 ring-slate-100"}`}>
      {children}
    </span>
  );
}

function PlanStatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${active ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : "bg-red-50 text-red-700 ring-red-100"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function FeaturedBadge({ featured }: { featured: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${featured ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-slate-50 text-slate-500 ring-slate-100"}`}>
      {featured ? "Featured" : "Standard"}
    </span>
  );
}

function AdminPlansEmpty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
        <Sparkles className="h-6 w-6" />
      </div>
      <h3 className="m-0 text-lg font-semibold text-[#20212c]">No plans found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74758a]">Create the first pricing tier for StoreIM.</p>
      <Button className="mt-5 inline-flex h-10 cursor-pointer items-center rounded-lg bg-[#7c3aed] px-4 text-sm font-semibold text-white hover:bg-[#6d28d9]" onClick={onCreate}>
        Create Plan
      </Button>
    </div>
  );
}

function limitLabel(value: number) {
  return value === 0 ? "Unlimited" : value.toLocaleString();
}

function formatMoney(value: string, currency: string) {
  return `${currency} ${Number(value).toLocaleString("en", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}
