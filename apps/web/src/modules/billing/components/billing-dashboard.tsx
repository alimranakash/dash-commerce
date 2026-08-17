"use client";

import { Button } from "@dash/ui";
import { CheckCircle2, CreditCard, FileText, ReceiptText, RotateCcw, WalletCards } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BillingActionState } from "../billing.actions";

type BillingPlan = {
  aiEnabled: boolean;
  currency: string;
  customDomainEnabled: boolean;
  description: string | null;
  id: string;
  isFeatured: boolean;
  name: string;
  orderLimit: number;
  priceMonthly: string;
  priceYearly: string;
  productLimit: number;
  staffLimit: number;
  storeLimit: number;
};

type BillingPayment = {
  amount: string;
  createdAt: string;
  currency: string;
  invoiceNumber: string;
  paymentMethod: string;
  paymentReference: string;
  status: string;
};

type BillingSettings = {
  bankAccountDetails: string | null;
  bkashAccountType: string | null;
  bkashNumber: string | null;
  nagadAccountType: string | null;
  nagadNumber: string | null;
  paymentInstructions: string | null;
  rocketAccountType: string | null;
  rocketNumber: string | null;
};

type BillingDashboardProps = {
  action: (state: BillingActionState, formData: FormData) => Promise<BillingActionState>;
  billingSettings: BillingSettings;
  plans: BillingPlan[];
  subscription: {
    billingCycle: "MONTHLY" | "YEARLY";
    cancelAtPeriodEnd: boolean;
    currentPeriodEndsAt: string;
    payments: BillingPayment[];
    planId: string;
    planName: string;
    status: string;
    trialRemaining: number | null;
  };
  usage: {
    aiUsage: number;
    orders: number;
    products: number;
    staff: number;
    storage: number;
    stores: number;
  };
};

const initialState: BillingActionState = { status: "idle" };

const paymentMethods = [
  { key: "BKASH", label: "bKash" },
  { key: "NAGAD", label: "Nagad" },
  { key: "ROCKET", label: "Rocket" },
  { key: "BANK", label: "Bank Transfer" }
] as const;

export function BillingDashboard({
  action,
  billingSettings,
  plans,
  subscription,
  usage
}: BillingDashboardProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [billingCycle, setBillingCycle] = useState<"MONTHLY" | "YEARLY">(subscription.billingCycle);
  const [planId, setPlanId] = useState(subscription.planId || plans[0]?.id || "");
  const selectedPlan = useMemo(() => plans.find((plan) => plan.id === planId) ?? plans[0], [planId, plans]);
  const currentPlan = useMemo(
    () => plans.find((plan) => plan.id === subscription.planId) ?? selectedPlan,
    [plans, selectedPlan, subscription.planId]
  );
  const selectedAmount = selectedPlan ? (billingCycle === "YEARLY" ? selectedPlan.priceYearly : selectedPlan.priceMonthly) : "0.00";

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <div className="grid gap-5">
      {state.status === "error" && state.message ? (
        <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.message}</p>
      ) : null}
      {state.status === "success" && state.message ? (
        <p className="m-0 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {state.message}
        </p>
      ) : null}
      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <BillingCard icon={<WalletCards className="h-5 w-5" />} title="Current Plan">
          <div className="grid gap-4 sm:grid-cols-2">
            <Info label="Plan Name" value={subscription.planName} />
            <Info label="Status" value={titleCase(subscription.status)} />
            <Info label="Trial Remaining" value={subscription.trialRemaining === null ? "No active trial" : `${subscription.trialRemaining} days`} />
            <Info label="Next Billing Date" value={subscription.currentPeriodEndsAt} />
            <Info label="Billing Cycle" value={titleCase(subscription.billingCycle)} />
            <Info label="Auto Renewal" value={subscription.cancelAtPeriodEnd ? "Off" : "On"} />
          </div>
        </BillingCard>

        <BillingCard icon={<CheckCircle2 className="h-5 w-5" />} title="Usage">
          <div className="grid gap-4">
            <UsageBar label="Products" limit={currentPlan?.productLimit ?? 0} value={usage.products} />
            <UsageBar label="Orders (this month)" limit={currentPlan?.orderLimit ?? 0} value={usage.orders} />
            <UsageBar label="Staff" limit={currentPlan?.staffLimit ?? 0} value={usage.staff} />
            <UsageBar label="Stores" limit={currentPlan?.storeLimit ?? 0} value={usage.stores} />
            <UsageBar label="Storage" limit={0} suffix="MB" value={usage.storage} />
            <UsageBar label="AI Usage" limit={currentPlan?.aiEnabled ? 1000 : 0} value={usage.aiUsage} />
          </div>
        </BillingCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <BillingCard icon={<CreditCard className="h-5 w-5" />} title="Upgrade Plan">
          <div className="mb-4 inline-flex rounded-xl border border-[#e2def6] bg-[#f8f7ff] p-1">
            <button className={`h-9 cursor-pointer rounded-lg px-4 text-xs font-semibold ${billingCycle === "MONTHLY" ? "bg-white text-[#6d3cf5] shadow-sm" : "text-[#66677a]"}`} onClick={() => setBillingCycle("MONTHLY")} type="button">Monthly</button>
            <button className={`h-9 cursor-pointer rounded-lg px-4 text-xs font-semibold ${billingCycle === "YEARLY" ? "bg-white text-[#6d3cf5] shadow-sm" : "text-[#66677a]"}`} onClick={() => setBillingCycle("YEARLY")} type="button">Yearly</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <button
                className={`cursor-pointer rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${plan.id === planId ? "border-[#7c3aed] bg-[#fbfaff] shadow-[0_12px_30px_rgba(124,58,237,0.12)]" : "border-[#ececf5] bg-white"}`}
                key={plan.id}
                onClick={() => setPlanId(plan.id)}
                type="button"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="m-0 text-base font-semibold text-[#20212c]">{plan.name}</h3>
                  {plan.isFeatured ? <span className="rounded-full bg-[#f0ebff] px-2 py-1 text-[10px] font-bold text-[#6d3cf5]">Popular</span> : null}
                </div>
                <p className="mt-2 min-h-10 text-xs leading-5 text-[#74758a]">{plan.description ?? "A clean plan for growing stores."}</p>
                <strong className="mt-4 block text-2xl text-[#20212c]">{plan.currency} {formatMoney(billingCycle === "YEARLY" ? plan.priceYearly : plan.priceMonthly)}</strong>
                <div className="mt-4 grid gap-1 text-xs text-[#626370]">
                  <span>{limitText(plan.productLimit)} products</span>
                  <span>{limitText(plan.orderLimit)} orders / month</span>
                  <span>{limitText(plan.staffLimit)} staff</span>
                  <span>{plan.aiEnabled ? "AI Assistant included" : "AI Assistant not included"}</span>
                </div>
              </button>
            ))}
          </div>
        </BillingCard>

        <BillingCard icon={<ReceiptText className="h-5 w-5" />} title="Manual Payment">
          <div className="grid gap-3 rounded-xl border border-[#ececf5] bg-[#fbfaff] p-4 text-xs text-[#565762]">
            <PaymentMethod label="bKash" number={billingSettings.bkashNumber} type={billingSettings.bkashAccountType} />
            <PaymentMethod label="Nagad" number={billingSettings.nagadNumber} type={billingSettings.nagadAccountType} />
            <PaymentMethod label="Rocket" number={billingSettings.rocketNumber} type={billingSettings.rocketAccountType} />
            {billingSettings.bankAccountDetails ? <p className="m-0 whitespace-pre-wrap"><b>Bank:</b> {billingSettings.bankAccountDetails}</p> : null}
            <p className="m-0 leading-5">{billingSettings.paymentInstructions ?? "Send the exact plan amount, then submit your transaction ID for manual verification."}</p>
          </div>
          <form action={formAction} className="mt-5 grid gap-4" ref={formRef}>
            <input name="billingCycle" type="hidden" value={billingCycle} />
            <input name="planId" type="hidden" value={selectedPlan?.id ?? ""} />
            <label className="grid gap-2 text-sm font-medium text-[#30313d]">
              Payment Method
              <select className={inputClass} name="paymentMethod" required>
                {paymentMethods.map((method) => <option key={method.key} value={method.key}>{method.label}</option>)}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#30313d]">
              Payable Amount
              <span className="flex h-11 items-center rounded-lg border border-[#dedcea] bg-[#fbfaff] px-3.5 text-sm font-semibold text-[#20212c]">
                ৳{formatMoney(selectedAmount)}
              </span>
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#30313d]">
              Transaction ID
              <input className={inputClass} name="paymentReference" placeholder="Enter transaction ID" required />
              <FieldError fieldErrors={state.fieldErrors} name="paymentReference" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#30313d]">
              Sender Number
              <input className={inputClass} name="senderNumber" placeholder="01XXXXXXXXX" required />
              <FieldError fieldErrors={state.fieldErrors} name="senderNumber" />
            </label>
            <label className="grid gap-2 text-sm font-medium text-[#30313d]">
              Payment Note
              <textarea className={`${inputClass} min-h-24 py-3`} name="paymentNote" placeholder="Optional note for admin verification" />
            </label>
            <Button className="h-11 cursor-pointer rounded-lg bg-[#7c3aed] font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60" disabled={isPending} type="submit">
              {isPending ? "Submitting..." : state.status === "success" ? "Submitted" : "Submit Payment for Verification"}
            </Button>
          </form>
        </BillingCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <BillingHistory payments={subscription.payments} title="Billing History" />
        <BillingHistory invoices payments={subscription.payments} title="Invoices" />
      </section>

      <BillingCard icon={<RotateCcw className="h-5 w-5" />} title="Subscription Settings">
        <p className="m-0 text-sm leading-6 text-[#74758a]">Manual billing is active for this workspace. Auto-renewal is shown for subscription tracking only; payments require admin verification before a plan becomes active.</p>
      </BillingCard>
    </div>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 text-sm font-normal text-[#2d2e38] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10";

function BillingCard({ children, icon, title }: { children: ReactNode; icon: ReactNode; title: string }) {
  return (
    <section className="rounded-2xl border border-[#ececf5] bg-white p-5 shadow-[0_10px_30px_rgba(62,54,114,0.05)]">
      <header className="mb-5 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#f0ebff] text-[#6d3cf5]">{icon}</span>
        <h2 className="m-0 text-base font-semibold text-[#20212c]">{title}</h2>
      </header>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#efeff5] bg-[#fbfaff] p-4">
      <p className="m-0 text-xs text-[#74758a]">{label}</p>
      <strong className="mt-1 block text-sm text-[#20212c]">{value}</strong>
    </div>
  );
}

function UsageBar({ label, limit, suffix = "", value }: { label: string; limit: number; suffix?: string; value: number }) {
  const unlimited = limit <= 0;
  const percent = unlimited ? 8 : Math.min(100, Math.round((value / Math.max(limit, 1)) * 100));

  return (
    <div>
      <div className="mb-1.5 flex justify-between text-xs">
        <span className="font-semibold text-[#30313d]">{label}</span>
        <span className="text-[#74758a]">{value}{suffix} / {unlimited ? "Unlimited" : `${limit}${suffix}`}</span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-[#f0eefb]">
        <div className="h-full rounded-full bg-[#7c3aed]" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function PaymentMethod({ label, number, type }: { label: string; number: string | null; type: string | null }) {
  if (!number && !type) return null;
  return <p className="m-0"><b>{label}:</b> {number ?? "Not set"} {type ? `(${type})` : ""}</p>;
}

function BillingHistory({ invoices = false, payments, title }: { invoices?: boolean; payments: BillingPayment[]; title: string }) {
  return (
    <BillingCard icon={<FileText className="h-5 w-5" />} title={title}>
      {payments.length ? (
        <div className="overflow-x-auto rounded-xl border border-[#efeff5]">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-[#f7f7fa] text-[#565762]">
              <tr>
                <th className="p-3">Invoice</th>
                <th className="p-3">Method</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Status</th>
                <th className="p-3">Date</th>
                {invoices ? <th className="p-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#efeff5]">
              {payments.map((payment) => (
                <tr key={payment.invoiceNumber}>
                  <td className="p-3 font-semibold text-[#20212c]">{payment.invoiceNumber}</td>
                  <td className="p-3">{titleCase(payment.paymentMethod)}</td>
                  <td className="p-3">{payment.currency} {formatMoney(payment.amount)}</td>
                  <td className="p-3"><StatusBadge status={payment.status} /></td>
                  <td className="p-3">{payment.createdAt}</td>
                  {invoices ? <td className="p-3 text-right"><button className="cursor-pointer text-xs font-semibold text-[#6d3cf5]" onClick={() => window.print()} type="button">View / Print</button></td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] p-8 text-center text-sm text-[#74758a]">No billing records yet.</div>
      )}
    </BillingCard>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone = status === "PAID" ? "bg-emerald-50 text-emerald-700 ring-emerald-100" : status === "PENDING" ? "bg-blue-50 text-blue-700 ring-blue-100" : "bg-amber-50 text-amber-700 ring-amber-100";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${tone}`}>{titleCase(status)}</span>;
}

function FieldError({ fieldErrors, name }: { fieldErrors: Record<string, string> | undefined; name: string }) {
  return fieldErrors?.[name] ? <span className="text-xs font-medium text-red-600">{fieldErrors[name]}</span> : null;
}

function limitText(value: number) {
  return value <= 0 ? "Unlimited" : value.toLocaleString("en");
}

function formatMoney(value: string) {
  return Number(value).toLocaleString("en", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function titleCase(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
