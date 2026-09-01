"use client";

import { Button } from "@dash/ui";
import { Loader2, MessageSquare, PenLine, ShieldCheck, TriangleAlert, Truck } from "lucide-react";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import type { StoreMessagingState } from "../store-messaging.actions";
import { CUSTOM_ORDER_SMS_MAX_LENGTH, CUSTOM_ORDER_SMS_PLACEHOLDERS } from "../templates";

type StoreMessagingView = {
  checkoutOtpEnabled: boolean;
  orderConfirmEnabled: boolean;
  orderCustomEnabled: boolean;
  orderCustomMessage: string;
  smsEnabled: boolean;
};

type Usage = { limit: number | null; remaining: number | null; used: number };

type Action = (state: StoreMessagingState, formData: FormData) => Promise<StoreMessagingState>;

const initialState: StoreMessagingState = { status: "idle" };
const inputClass =
  "mt-2 h-11 w-full rounded-lg border border-[#e4e3ee] bg-white px-3.5 text-sm text-[#30313d] outline-none transition placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10";
const labelClass = "block text-sm font-semibold text-[#20212c]";
// The same field, minus the fixed height a single-line input wants.
const textareaClass = `${inputClass.replace("h-11 ", "")} min-h-24 resize-y py-2.5 leading-6`;

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
  const { openUpgrade } = useUpgradePrompt();
  const [customEnabled, setCustomEnabled] = useState(settings.orderCustomEnabled);
  const [customMessage, setCustomMessage] = useState(settings.orderCustomMessage);
  const outOfAllowance = usage.remaining !== null && usage.remaining <= 0;

  // Switching SMS on without the plan for it opens the shared upgrade dialog.
  // Switching it off is never refused — see `saveStoreMessagingAction`.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);

  return (
    <div className="grid gap-4">
      {outOfAllowance ? (
        <Banner tone="warning">
          You have used all {usage.limit} messages included in your plan this month. Sending starts
          again on the first of next month, or sooner on a bigger plan.
        </Banner>
      ) : null}

      {state.message && !state.lockedFeature ? (
        <Banner tone={state.status === "error" ? "error" : "success"}>{state.message}</Banner>
      ) : null}

      <form action={formAction} className="grid gap-4">
        <Card
          icon={<MessageSquare className="h-4 w-4" />}
          note="Messages are sent for you, and how many you get each month comes with your plan. Each one costs, so every option here starts switched off."
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
          <Toggle
            defaultChecked={settings.orderCustomEnabled}
            hint="Your own words, sent at the same moment as the order is placed. This is a second message on top of the one above, so it costs again on every order."
            icon={<PenLine className="h-4 w-4" />}
            label="Send my own message when an order is placed"
            name="orderCustomEnabled"
            onCheckedChange={setCustomEnabled}
          >
            <CustomMessageField
              hidden={!customEnabled}
              onChange={setCustomMessage}
              value={customMessage}
            />
          </Toggle>
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
    usage.limit === null
      ? 0
      : Math.min(100, Math.round((usage.used / Math.max(1, usage.limit)) * 100));

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

      <form
        action={formAction}
        className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      >
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

function Banner({
  children,
  tone
}: {
  children: ReactNode;
  tone: "error" | "success" | "warning";
}) {
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
  children,
  defaultChecked,
  hint,
  icon,
  label,
  name,
  onCheckedChange
}: {
  children?: ReactNode;
  defaultChecked: boolean;
  hint: string;
  icon?: ReactNode;
  label: string;
  name: string;
  onCheckedChange?: ((checked: boolean) => void) | undefined;
}) {
  return (
    <div className="rounded-lg border border-[#eeecf7] bg-[#fbfaff] px-3 py-3">
      {/* Anything revealed by the switch sits outside the label, so that
          clicking into a field does not read as clicking the label. */}
      <label className="flex items-start gap-3">
        <input
          className="mt-0.5 h-4 w-4 accent-[#7c3aed]"
          defaultChecked={defaultChecked}
          name={name}
          onChange={onCheckedChange ? (event) => onCheckedChange(event.target.checked) : undefined}
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
      {children}
    </div>
  );
}

/**
 * Stays mounted when the switch is off instead of unmounting.
 *
 * A field that disappears submits nothing, and saving with it gone would wipe
 * copy the seller spent time on the moment they turned the message off for a
 * week. Hidden, it still submits, so the words survive being switched off.
 */
function CustomMessageField({
  hidden,
  onChange,
  value
}: {
  hidden: boolean;
  onChange: (value: string) => void;
  value: string;
}) {
  const segments = countSmsSegments(value);
  const overLimit = value.length > CUSTOM_ORDER_SMS_MAX_LENGTH;

  return (
    <div className={hidden ? "hidden" : "mt-3 border-t border-[#eeecf7] pt-3"}>
      <label className={labelClass} htmlFor="orderCustomMessage">
        What it should say
      </label>
      <textarea
        className={textareaClass}
        id="orderCustomMessage"
        name="orderCustomMessage"
        onChange={(event) => onChange(event.target.value)}
        placeholder="Thank you for order {order}. We will call you shortly to confirm delivery."
        rows={3}
        value={value}
      />
      <p className="m-0 mt-2 text-xs leading-5 text-[#74758a]">
        Type {CUSTOM_ORDER_SMS_PLACEHOLDERS.join(", ")} anywhere and each one is filled in with the
        real order before it is sent.
      </p>
      <p
        className={`m-0 mt-1 text-xs leading-5 ${overLimit ? "text-[#a43b4d]" : "text-[#74758a]"}`}
      >
        {value.length} of {CUSTOM_ORDER_SMS_MAX_LENGTH} characters
        {segments > 0
          ? ` — about ${segments} message${segments === 1 ? "" : "s"} from your allowance`
          : ""}
        .
        {hasNonAscii(value)
          ? " Bangla letters fit 70 characters in a message instead of 160, so the same words cost more to send."
          : ""}
      </p>
    </div>
  );
}

/**
 * Roughly how many messages a body will be billed as. Deliberately approximate:
 * the placeholders are still unexpanded here, and a handful of ASCII characters
 * count double on a GSM keypad. Close enough to warn a seller that the sentence
 * they just added doubles their bill, which is the only thing it is for.
 */
function countSmsSegments(message: string) {
  if (!message) {
    return 0;
  }

  const unicode = hasNonAscii(message);
  const alone = unicode ? 70 : 160;
  const joined = unicode ? 67 : 153;

  return message.length <= alone ? 1 : Math.ceil(message.length / joined);
}

function hasNonAscii(message: string) {
  // eslint-disable-next-line no-control-regex
  return /[^\u0000-\u007f]/.test(message);
}
