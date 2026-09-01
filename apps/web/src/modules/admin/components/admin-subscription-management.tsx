"use client";

import { Button } from "@dash/ui";
import { CalendarClock, CheckCircle2, Edit3, Eye, MessageSquare, PauseCircle, RotateCcw, Search, TimerReset, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { AdminMobileField } from "../../../components/admin/admin-ui";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import {
  activateSubscriptionAction,
  cancelSubscriptionAction,
  changeSubscriptionPlanAction,
  deleteSubscriptionAction,
  extendSubscriptionTrialAction,
  markSubscriptionPastDueAction,
  resumeSubscriptionAction,
  setSubscriptionSmsLimitAction,
  type SubscriptionActionState
} from "../admin-subscriptions.actions";
import { BILLING_CYCLE_DAYS } from "../admin-subscriptions.schema";

export type AdminSubscriptionListItem = {
  billingCycle: "MONTHLY" | "YEARLY";
  cancelAtPeriodEnd: boolean;
  cancelledAt: string;
  createdAt: string;
  currentPeriod: string;
  id: string;
  ownerEmail: string;
  ownerImage?: string | null;
  ownerName: string;
  paymentCount: number;
  planId: string;
  planName: string;
  planSmsLimit: number;
  smsLimitOverride: number | null;
  status: "ACTIVE" | "CANCELLED" | "EXPIRED" | "PAST_DUE" | "TRIALING";
  storeArchived: boolean;
  storeDomain: string;
  storeName: string;
  storeSlug: string;
  trialDates: string;
  trialEndsAt: string;
};

export type AdminSubscriptionPlanOption = {
  id: string;
  name: string;
};

type AdminSubscriptionManagementProps = {
  activeBillingCycle: string;
  activePlanId: string;
  activeStatus: string;
  plans: AdminSubscriptionPlanOption[];
  search: string;
  subscriptions: AdminSubscriptionListItem[];
};

type StatusAction = {
  action: (subscriptionId: string) => Promise<void>;
  label: string;
  message: string;
  title: string;
};

const initialActionState: SubscriptionActionState = {
  status: "idle"
};

const statusOptions = [
  { label: "All", value: "all" },
  { label: "Trialing", value: "trialing" },
  { label: "Active", value: "active" },
  { label: "Past Due", value: "past_due" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Expired", value: "expired" }
];

const billingOptions = [
  { label: "All cycles", value: "all" },
  { label: "Monthly", value: "monthly" },
  { label: "Yearly", value: "yearly" }
];

export function AdminSubscriptionManagement({
  activeBillingCycle,
  activePlanId,
  activeStatus,
  plans,
  search,
  subscriptions
}: AdminSubscriptionManagementProps) {
  const [selectedSubscription, setSelectedSubscription] = useState<AdminSubscriptionListItem | null>(null);
  const [planTarget, setPlanTarget] = useState<AdminSubscriptionListItem | null>(null);
  const [trialTarget, setTrialTarget] = useState<AdminSubscriptionListItem | null>(null);
  const [smsTarget, setSmsTarget] = useState<AdminSubscriptionListItem | null>(null);
  const [statusTarget, setStatusTarget] = useState<{ action: StatusAction; subscription: AdminSubscriptionListItem } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminSubscriptionListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const hasSubscriptions = subscriptions.length > 0;
  const filterLabel = useMemo(() => {
    const status = statusOptions.find((option) => option.value === activeStatus)?.label ?? "All";
    const billing = billingOptions.find((option) => option.value === activeBillingCycle)?.label ?? "All cycles";
    const plan = plans.find((option) => option.id === activePlanId)?.name ?? "All plans";
    return `${status} / ${plan} / ${billing}`;
  }, [activeBillingCycle, activePlanId, activeStatus, plans]);

  function runAction(action: (subscriptionId: string) => Promise<void>, subscriptionId: string, onDone?: () => void) {
    startTransition(async () => {
      await action(subscriptionId);
      onDone?.();
    });
  }

  function deleteSubscription(subscriptionId: string) {
    startTransition(async () => {
      const result = await deleteSubscriptionAction(subscriptionId);

      setDeleteError(result.ok ? null : result.message);
      setDeleteTarget(null);
    });
  }

  /** Shared by the desktop row and the mobile card so the two cannot drift apart. */
  function subscriptionActions(subscription: AdminSubscriptionListItem) {
    return (
      <>
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#6d3cf5] hover:bg-[#f3f0ff]" onClick={() => setSelectedSubscription(subscription)} title="View details" type="button">
          <Eye className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#2563eb] hover:bg-blue-50" onClick={() => setPlanTarget(subscription)} title="Change plan" type="button">
          <Edit3 className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#7c3aed] hover:bg-[#f3f0ff]" onClick={() => setTrialTarget(subscription)} title="Extend trial" type="button">
          <TimerReset className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-[#0f766e] hover:bg-teal-50" onClick={() => setSmsTarget(subscription)} title="SMS allowance" type="button">
          <MessageSquare className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50" disabled={pending} onClick={() => setStatusTarget({ action: statusActions.activate, subscription })} title="Activate" type="button">
          <CheckCircle2 className="h-4 w-4" />
        </button>
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-amber-700 hover:bg-amber-50" disabled={pending} onClick={() => setStatusTarget({ action: statusActions.pastDue, subscription })} title="Mark past due" type="button">
          <CalendarClock className="h-4 w-4" />
        </button>
        {subscription.status === "CANCELLED" ? (
          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-emerald-700 hover:bg-emerald-50" disabled={pending} onClick={() => setStatusTarget({ action: statusActions.resume, subscription })} title="Resume" type="button">
            <RotateCcw className="h-4 w-4" />
          </button>
        ) : (
          <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-red-600 hover:bg-red-50" disabled={pending} onClick={() => setStatusTarget({ action: statusActions.cancel, subscription })} title="Cancel" type="button">
            <PauseCircle className="h-4 w-4" />
          </button>
        )}
        <button className="grid h-8 w-8 cursor-pointer place-items-center rounded-lg text-red-600 hover:bg-red-50" disabled={pending} onClick={() => setDeleteTarget(subscription)} title="Delete" type="button">
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
        <div className="mb-5 flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
          <div>
            <h2 className="m-0 text-base font-semibold text-[#20212c]">Subscriptions</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">Showing {filterLabel.toLowerCase()} subscriptions.</p>
          </div>

          <DashboardQueryForm actionPath="/admin/subscriptions" className="grid gap-3 sm:grid-cols-2 2xl:w-[840px] 2xl:grid-cols-[minmax(220px,1fr)_150px_170px_150px_44px]">
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={search}
              name="search"
              placeholder="Search store, owner, plan"
              type="search"
            />
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeStatus} name="status">
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activePlanId} name="planId">
              <option value="all">All plans</option>
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={activeBillingCycle} name="billingCycle">
              {billingOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button aria-label="Search subscriptions" className="grid h-11 cursor-pointer place-items-center rounded-lg bg-[#7c3aed] text-white hover:bg-[#6d28d9] sm:col-span-2 2xl:col-span-1" type="submit">
              <Search className="h-4 w-4" />
            </button>
          </DashboardQueryForm>
        </div>

        {hasSubscriptions ? (
          <>
            <div className="hidden overflow-hidden rounded-xl border border-[#efeff5] bg-white lg:block">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1180px] border-collapse text-left text-xs">
                  <thead className="bg-[#f7f7fa] text-[#565762]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Store</th>
                      <th className="px-4 py-3 font-semibold">Owner</th>
                      <th className="px-4 py-3 font-semibold">Plan</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Billing Cycle</th>
                      <th className="px-4 py-3 font-semibold">Trial Ends</th>
                      <th className="px-4 py-3 font-semibold">Current Period</th>
                      <th className="px-4 py-3 font-semibold">Created</th>
                      <th className="px-4 py-3 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efeff5]">
                    {subscriptions.map((subscription) => (
                      <tr className="transition hover:bg-[#fbfaff]" key={subscription.id}>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-[#20212c]">{subscription.storeName}</div>
                          <div className="mt-1 text-[11px] text-[#74758a]">{subscription.storeDomain}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-[#30313d]">{subscription.ownerName}</div>
                          <div className="mt-1 text-[11px] text-[#74758a]">{subscription.ownerEmail}</div>
                        </td>
                        <td className="px-4 py-4 font-semibold text-[#20212c]">{subscription.planName}</td>
                        <td className="px-4 py-4"><SubscriptionStatusBadge status={subscription.status} /></td>
                        <td className="px-4 py-4"><BillingBadge billingCycle={subscription.billingCycle} /></td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{subscription.trialEndsAt}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{subscription.currentPeriod}</td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{subscription.createdAt}</td>
                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-1.5">{subscriptionActions(subscription)}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="grid gap-3 lg:hidden">
              {subscriptions.map((subscription) => (
                <article className="rounded-xl border border-[#efeff5] bg-white p-4" key={subscription.id}>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[#20212c]">{subscription.storeName}</div>
                    <div className="mt-0.5 break-all text-[11px] text-[#74758a]">{subscription.storeDomain}</div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <SubscriptionStatusBadge status={subscription.status} />
                    <BillingBadge billingCycle={subscription.billingCycle} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-3 border-t border-[#f0eff5] pt-3">
                    <AdminMobileField label="Plan" value={subscription.planName} />
                    <AdminMobileField label="Owner" value={subscription.ownerName} />
                    <AdminMobileField label="Email" value={subscription.ownerEmail} />
                    <AdminMobileField label="Trial ends" value={subscription.trialEndsAt} />
                    <AdminMobileField label="Current period" value={subscription.currentPeriod} />
                    <AdminMobileField label="Created" value={subscription.createdAt} />
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[#f0eff5] pt-3">{subscriptionActions(subscription)}</div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <AdminSubscriptionsEmpty />
        )}
      </section>

      {selectedSubscription ? <SubscriptionDetailsModal onClose={() => setSelectedSubscription(null)} subscription={selectedSubscription} /> : null}
      {planTarget ? <ChangePlanModal onClose={() => setPlanTarget(null)} plans={plans} subscription={planTarget} /> : null}
      {trialTarget ? <ExtendTrialModal onClose={() => setTrialTarget(null)} subscription={trialTarget} /> : null}
      {smsTarget ? <SmsAllowanceModal onClose={() => setSmsTarget(null)} subscription={smsTarget} /> : null}
      {deleteTarget ? (
        <DeleteSubscriptionModal
          disabled={pending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => deleteSubscription(deleteTarget.id)}
          subscription={deleteTarget}
        />
      ) : null}
      {statusTarget ? (
        <StatusConfirmModal
          disabled={pending}
          onClose={() => setStatusTarget(null)}
          onConfirm={() => runAction(statusTarget.action.action, statusTarget.subscription.id, () => setStatusTarget(null))}
          statusAction={statusTarget.action}
          subscription={statusTarget.subscription}
        />
      ) : null}
    </>
  );
}

const statusActions = {
  activate: {
    action: activateSubscriptionAction,
    label: "Activate",
    message: "This will move the subscription to Active immediately.",
    title: "Activate Subscription"
  },
  cancel: {
    action: cancelSubscriptionAction,
    label: "Cancel",
    message: "This will cancel the subscription and mark it as ending. Billing collection is not connected yet.",
    title: "Cancel Subscription"
  },
  pastDue: {
    action: markSubscriptionPastDueAction,
    label: "Mark Past Due",
    message: "This will mark the subscription as past due for admin tracking.",
    title: "Mark Subscription Past Due"
  },
  resume: {
    action: resumeSubscriptionAction,
    label: "Resume",
    message: "This will reactivate the subscription and clear cancellation flags.",
    title: "Resume Subscription"
  }
} satisfies Record<string, StatusAction>;

function ChangePlanModal({ onClose, plans, subscription }: { onClose: () => void; plans: AdminSubscriptionPlanOption[]; subscription: AdminSubscriptionListItem }) {
  const [state, formAction, isPending] = useActionState(changeSubscriptionPlanAction.bind(null, subscription.id), initialActionState);
  const [billingCycle, setBillingCycle] = useState(subscription.billingCycle);
  const [startsAt, setStartsAt] = useState(todayInputValue);
  const periodEndLabel = formatPeriodEnd(startsAt, billingCycle);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state.status]);

  return (
    <div aria-modal="true" className="fixed inset-0 z-[100] flex justify-center overflow-y-auto bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <form action={formAction} className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <ModalHeader onClose={onClose} subtitle={subscription.storeName} title="Change Plan" />
        <div className="grid gap-4 p-5">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#20212c]">Plan</span>
            <select className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10" defaultValue={subscription.planId} name="planId">
              {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
            </select>
            {state.fieldErrors?.planId ? <span className="text-xs font-medium text-red-600">{state.fieldErrors.planId}</span> : null}
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#20212c]">Billing Cycle</span>
            <select
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              name="billingCycle"
              onChange={(event) => setBillingCycle(event.target.value as AdminSubscriptionListItem["billingCycle"])}
              value={billingCycle}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </select>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#20212c]">Start Date</span>
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              name="startsAt"
              onChange={(event) => setStartsAt(event.target.value)}
              type="date"
              value={startsAt}
            />
            <span className="text-[11px] text-[#74758a]">
              {billingCycle === "YEARLY" ? "Yearly runs 365 days" : "Monthly runs 30 days"} from this date
              {periodEndLabel ? ` — ends ${periodEndLabel}.` : "."}
            </span>
            {state.fieldErrors?.startsAt ? <span className="text-xs font-medium text-red-600">{state.fieldErrors.startsAt}</span> : null}
          </label>
          {state.message && state.status === "error" ? <p className="m-0 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.message}</p> : null}
        </div>
        <ModalActions disabled={isPending} onClose={onClose} primaryLabel={isPending ? "Saving..." : "Save Changes"} />
      </form>
    </div>
  );
}

/**
 * One store's monthly message allowance, set apart from its plan.
 *
 * Blank hands it back to the plan rather than meaning zero, because "no number
 * here" and "no messages at all" are very different intentions and an admin
 * clearing a field almost never means the second.
 */
function SmsAllowanceModal({ onClose, subscription }: { onClose: () => void; subscription: AdminSubscriptionListItem }) {
  const [state, formAction, isPending] = useActionState(setSubscriptionSmsLimitAction.bind(null, subscription.id), initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state.status]);

  return (
    <div aria-modal="true" className="fixed inset-0 z-[100] flex justify-center overflow-y-auto bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <form action={formAction} className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <ModalHeader onClose={onClose} subtitle={subscription.storeName} title="SMS Allowance" />
        <div className="grid gap-4 p-5">
          <p className="m-0 rounded-lg bg-[#f7f7fb] px-4 py-3 text-sm text-[#565762]">
            The <b>{subscription.planName}</b> plan allows{" "}
            {subscription.planSmsLimit <= 0 ? "unlimited" : subscription.planSmsLimit} messages a month.
            {subscription.smsLimitOverride === null
              ? " This store follows the plan."
              : ` This store is currently set to ${subscription.smsLimitOverride === 0 ? "unlimited" : subscription.smsLimitOverride}.`}
          </p>
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#20212c]">Messages per month</span>
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={subscription.smsLimitOverride ?? ""}
              min={0}
              name="smsLimitOverride"
              placeholder="Leave blank to follow the plan"
              type="number"
            />
            <span className="text-xs text-[#74758a]">Leave blank to follow the plan. Enter 0 for unlimited.</span>
            {state.fieldErrors?.smsLimitOverride ? <span className="text-xs font-medium text-red-600">{state.fieldErrors.smsLimitOverride}</span> : null}
          </label>
          {state.message && state.status === "error" ? <p className="m-0 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.message}</p> : null}
        </div>
        <ModalActions disabled={isPending} onClose={onClose} primaryLabel={isPending ? "Saving..." : "Save allowance"} />
      </form>
    </div>
  );
}

function ExtendTrialModal({ onClose, subscription }: { onClose: () => void; subscription: AdminSubscriptionListItem }) {
  const [state, formAction, isPending] = useActionState(extendSubscriptionTrialAction.bind(null, subscription.id), initialActionState);

  useEffect(() => {
    if (state.status === "success") {
      onClose();
    }
  }, [onClose, state.status]);

  return (
    <div aria-modal="true" className="fixed inset-0 z-[100] flex justify-center overflow-y-auto bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <form action={formAction} className="my-auto w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <ModalHeader onClose={onClose} subtitle={subscription.storeName} title="Extend Trial" />
        <div className="grid gap-4 p-5">
          <label className="grid gap-2">
            <span className="text-sm font-semibold text-[#20212c]">Additional Days</span>
            <input
              className="h-11 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
              defaultValue={7}
              min={1}
              name="days"
              type="number"
            />
            {state.fieldErrors?.days ? <span className="text-xs font-medium text-red-600">{state.fieldErrors.days}</span> : null}
          </label>
          {state.message && state.status === "error" ? <p className="m-0 rounded-lg bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{state.message}</p> : null}
        </div>
        <ModalActions disabled={isPending} onClose={onClose} primaryLabel={isPending ? "Extending..." : "Extend Trial"} />
      </form>
    </div>
  );
}

function SubscriptionDetailsModal({ onClose, subscription }: { onClose: () => void; subscription: AdminSubscriptionListItem }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[100] flex justify-end bg-[#20212a]/45" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <aside className="h-full w-full max-w-xl overflow-y-auto bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-[#efeff5] pb-4">
          <div>
            <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">Subscription Details</p>
            <h2 className="m-0 mt-1 text-xl font-semibold text-[#20212c]">{subscription.storeName}</h2>
            <p className="m-0 mt-1 text-sm text-[#74758a]">{subscription.storeDomain}</p>
          </div>
          <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4">
          <DetailSection title="Store Info">
            <DetailRow label="Store" value={subscription.storeName} />
            <DetailRow label="Store URL" value={subscription.storeDomain} />
          </DetailSection>
          <DetailSection title="Owner Info">
            <DetailRow label="Owner" value={subscription.ownerName} />
            <DetailRow label="Email" value={subscription.ownerEmail} />
          </DetailSection>
          <DetailSection title="Current Plan">
            <DetailRow label="Plan" value={subscription.planName} />
            <DetailRow label="Billing Cycle" value={titleCase(subscription.billingCycle)} />
            <div className="mt-3 flex flex-wrap gap-2">
              <SubscriptionStatusBadge status={subscription.status} />
              <BillingBadge billingCycle={subscription.billingCycle} />
            </div>
          </DetailSection>
          <DetailSection title="Trial & Billing">
            <DetailRow label="Trial Dates" value={subscription.trialDates} />
            <DetailRow label="Current Period" value={subscription.currentPeriod} />
            <DetailRow label="Cancel At Period End" value={subscription.cancelAtPeriodEnd ? "Yes" : "No"} />
            <DetailRow label="Cancelled At" value={subscription.cancelledAt} />
          </DetailSection>
        </div>
      </aside>
    </div>
  );
}

function StatusConfirmModal({
  disabled,
  onClose,
  onConfirm,
  statusAction,
  subscription
}: {
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
  statusAction: StatusAction;
  subscription: AdminSubscriptionListItem;
}) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[110] flex justify-center overflow-y-auto bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <div className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
          <CalendarClock className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-center text-xl font-semibold text-[#20212c]">{statusAction.title}</h2>
        <p className="mt-2 text-center text-sm leading-6 text-[#74758a]">
          {statusAction.message} Store: {subscription.storeName}.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button className="h-11 cursor-pointer rounded-lg border border-[#dedcf0] font-semibold text-[#30313d] hover:bg-[#f7f5ff]" disabled={disabled} onClick={onClose} type="button">Cancel</button>
          <Button className="h-11 cursor-pointer rounded-lg bg-[#7c3aed] font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60" disabled={disabled} onClick={onConfirm} type="button">
            {disabled ? "Updating..." : statusAction.label}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Deleting takes the payment history with it, and — for a store that is still
 * live — is undone by the platform handing that store a fresh default
 * subscription on the next load. Both are spelled out here rather than left for
 * the admin to discover after confirming.
 */
function DeleteSubscriptionModal({
  disabled,
  onClose,
  onConfirm,
  subscription
}: {
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
  subscription: AdminSubscriptionListItem;
}) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-[110] flex justify-center overflow-y-auto bg-[#20212a]/45 p-4" onMouseDown={(event) => event.target === event.currentTarget && onClose()} role="dialog">
      <div className="my-auto w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-50 text-red-600">
          <Trash2 className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-center text-xl font-semibold text-[#20212c]">Delete Subscription</h2>
        <p className="mt-2 text-center text-sm leading-6 text-[#74758a]">
          Delete the {subscription.planName} subscription for {subscription.storeName}?
          {subscription.paymentCount > 0
            ? ` Its ${subscription.paymentCount} payment record${subscription.paymentCount === 1 ? "" : "s"} go with it.`
            : ""}{" "}
          This action cannot be undone.
        </p>
        {subscription.storeArchived ? null : (
          <p className="mt-3 rounded-lg bg-amber-50 px-4 py-3 text-center text-xs font-medium leading-5 text-amber-800">
            {subscription.storeName} is still live, so it is given a fresh free-plan trial subscription the next time this page loads. Archive the store from Stores first if the row should stay gone.
          </p>
        )}
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

function ModalHeader({ onClose, subtitle, title }: { onClose: () => void; subtitle: string; title: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-[#efeff5] p-5">
      <div>
        <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7c3aed]">Admin Subscriptions</p>
        <h2 className="m-0 mt-1 text-xl font-semibold text-[#20212c]">{title}</h2>
        <p className="m-0 mt-1 text-sm text-[#74758a]">{subtitle}</p>
      </div>
      <button className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]" onClick={onClose} type="button">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ModalActions({ disabled, onClose, primaryLabel }: { disabled: boolean; onClose: () => void; primaryLabel: string }) {
  return (
    <div className="flex flex-col gap-3 border-t border-[#efeff5] p-5 sm:flex-row sm:justify-end">
      <button className="h-11 cursor-pointer rounded-lg border border-[#dedcf0] px-4 font-semibold text-[#30313d] hover:bg-[#f7f5ff]" disabled={disabled} onClick={onClose} type="button">Cancel</button>
      <Button className="h-11 cursor-pointer rounded-lg bg-[#7c3aed] px-5 font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60" disabled={disabled} type="submit">
        {primaryLabel}
      </Button>
    </div>
  );
}

function SubscriptionStatusBadge({ status }: { status: AdminSubscriptionListItem["status"] }) {
  const styles = {
    ACTIVE: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    CANCELLED: "bg-red-50 text-red-700 ring-red-100",
    EXPIRED: "bg-slate-50 text-slate-600 ring-slate-100",
    PAST_DUE: "bg-amber-50 text-amber-700 ring-amber-100",
    TRIALING: "bg-blue-50 text-blue-700 ring-blue-100"
  }[status];

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${styles}`}>{titleCase(status)}</span>;
}

function BillingBadge({ billingCycle }: { billingCycle: AdminSubscriptionListItem["billingCycle"] }) {
  return (
    <span className="inline-flex rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700 ring-1 ring-violet-100">
      {titleCase(billingCycle)}
    </span>
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

function AdminSubscriptionsEmpty() {
  return (
    <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
        <CalendarClock className="h-6 w-6" />
      </div>
      <h3 className="m-0 text-lg font-semibold text-[#20212c]">No subscriptions found</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#74758a]">Subscriptions matching your search and filters will appear here.</p>
    </div>
  );
}

/** Today as a `yyyy-mm-dd` value for `<input type="date">`, in local time. */
function todayInputValue() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

/** Preview of where the period lands, using the same day counts as the server. */
function formatPeriodEnd(startsAt: string, billingCycle: "MONTHLY" | "YEARLY") {
  if (!startsAt) {
    return "";
  }

  const start = new Date(startsAt);

  if (Number.isNaN(start.getTime())) {
    return "";
  }

  start.setDate(start.getDate() + (BILLING_CYCLE_DAYS[billingCycle] ?? 30));

  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(start);
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
