"use client";

import { Button } from "@dash/ui";
import { Loader2, MessageSquare, ShieldCheck, TriangleAlert, Truck } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import type { StoreMessagingState } from "../store-messaging.actions";

type StoreMessagingView = {
  checkoutOtpEnabled: boolean;
  orderConfirmEnabled: boolean;
  smsEnabled: boolean;
};

type Usage = { limit: number | null; remaining: number | null; used: number };

type Action = (state: StoreMessagingState, formData: FormData) => Promise<StoreMessagingState>;

const initialState: StoreMessagingState = { status: "idle" };
const inputClass =
  "mt-2 h-11 w-full rounded-lg border border-[#e4e3ee] bg-white px-3.5 text-sm text-[#30313d] outline-none transition placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10";
const labelClass = "block text-sm font-semibold text-[#20212c]";

export function StoreSmsSettings({
  saveAction,
  settings,
  testAction,
  usage
}: {
  saveAction: Action;
  settings: StoreMessagingView;
  testAction: Action;
  usage: Usage;
}) {
  const [state, formAction, isPending] = useActionState(saveAction, initialState);
  const outOfAllowance = usage.remaining !== null && usage.remaining <= 0;

  return (
    <div className="grid gap-4">
      {outOfAllowance ? (
        <Banner tone="warning">
          You have used all {usage.limit} messages included in your plan this month. Sending starts
          again on the first of next month, or sooner on a bigger plan.
        </Banner>
      ) : null}

      {state.message ? (
        <Banner tone={state.status === "error" ? "error" : "success"}>{state.message}</Banner>
      ) : null}

      <form action={formAction} className="grid gap-4">
        <Card
          icon={<MessageSquare className="h-4 w-4" />}
          note="Messages are sent for you, and how many you get each month comes with your plan. Each one costs, so both uses start switched off."
          title="Customer SMS"
        >
          <Toggle
            defaultChecked={settings.smsEnabled}
            hint="The master switch. With this off nothing is sent, whatever the options below say."
            label="Send SMS to my customers"
            name="smsEnabled"
          />
          <Toggle
            defaultChecked={settings.checkoutOtpEnabled}
            hint="Cash-on-delivery orders only. The shopper types a code before the order can be placed, which stops orders from numbers that do not exist."
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Confirm cash-on-delivery numbers with a code"
            name="checkoutOtpEnabled"
          />
          <Toggle
            defaultChecked={settings.orderConfirmEnabled}
            hint="One message per order, sent the moment it goes through, with the order number and total. This is your highest-volume message."
            icon={<Truck className="h-4 w-4" />}
            label="Text order details when an order is placed"
            name="orderConfirmEnabled"
          />
        </Card>

        <div>
          <Button
            className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6d28d9] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
            {isPending ? "Saving..." : "Save SMS settings"}
          </Button>
        </div>
      </form>

      <UsageCard usage={usage} />
      <TestSender action={testAction} />
    </div>
  );
}

function UsageCard({ usage }: { usage: Usage }) {
  const percent =
    usage.limit === null ? 0 : Math.min(100, Math.round((usage.used / Math.max(1, usage.limit)) * 100));

  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <h2 className="m-0 text-base font-semibold text-[#20212c]">This month</h2>
      <p className="m-0 mt-1 text-sm text-[#74758a]">
        {usage.limit === null
          ? `${usage.used} sent. Your plan does not cap how many you send.`
          : `${usage.used} of ${usage.limit} sent — ${usage.remaining} left. The count resets on the first of the month.`}
      </p>
      {usage.limit === null ? null : (
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#f1eff9]">
          <div
            className={`h-full rounded-full ${percent >= 100 ? "bg-[#c02b52]" : percent >= 80 ? "bg-[#c08a2b]" : "bg-[#7c3aed]"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
      )}
    </section>
  );
}

function TestSender({ action }: { action: Action }) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <h2 className="m-0 text-base font-semibold text-[#20212c]">Send yourself a test</h2>
      <p className="m-0 mt-1 text-sm text-[#74758a]">
        See exactly what your customers get. A test counts towards this month&apos;s messages, like
        any other.
      </p>

      {state.message ? (
        <div className="mt-4">
          <Banner tone={state.status === "error" ? "error" : "success"}>{state.message}</Banner>
        </div>
      ) : null}

      <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <label className={labelClass}>
          Send to
          <input className={inputClass} name="recipient" placeholder="01XXXXXXXXX" />
        </label>
        <Button
          className="h-11 rounded-lg border border-[#e4e3ee] bg-white px-5 text-sm font-semibold text-[#565762] hover:bg-[#f7f7fa] disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Sending..." : "Send test"}
        </Button>
      </form>
    </section>
  );
}

function Banner({ children, tone }: { children: ReactNode; tone: "error" | "success" | "warning" }) {
  const tones = {
    error: "border-[#f2ccd2] bg-[#fff0f2] text-[#a43b4d]",
    success: "border-[#c6ead9] bg-[#edfbf5] text-[#177356]",
    warning: "border-amber-200 bg-amber-50 text-amber-900"
  };

  return (
    <p className={`m-0 flex items-start gap-2 rounded-xl border p-4 text-sm ${tones[tone]}`}>
      {tone === "warning" ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> : null}
      <span>{children}</span>
    </p>
  );
}

function Card({
  children,
  icon,
  note,
  title
}: {
  children: ReactNode;
  icon: ReactNode;
  note: string;
  title: string;
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[#7c3aed]">{icon}</span>
          <h2 className="m-0 text-base font-semibold text-[#20212c]">{title}</h2>
        </div>
        <p className="m-0 mt-1 text-sm text-[#74758a]">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Toggle({
  defaultChecked,
  hint,
  icon,
  label,
  name
}: {
  defaultChecked: boolean;
  hint: string;
  icon?: ReactNode;
  label: string;
  name: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-[#eeecf7] bg-[#fbfaff] px-3 py-3">
      <input
        className="mt-0.5 h-4 w-4 accent-[#7c3aed]"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-[#30313d]">
          {icon ? <span className="text-[#7c3aed]">{icon}</span> : null}
          {label}
        </span>
        <span className="mt-1 block text-xs leading-5 text-[#74758a]">{hint}</span>
      </span>
    </label>
  );
}
