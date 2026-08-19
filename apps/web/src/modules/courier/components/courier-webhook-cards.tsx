"use client";

import { Check, Copy, Eye, EyeOff, Loader2, RadioTower } from "lucide-react";
import { useState, useTransition } from "react";
import { PaidBadge } from "../../billing/components/paid-badge";
import { PlanUpgradeDialog } from "../../billing/components/plan-upgrade-dialog";
import {
  disableCourierWebhookAction,
  generateCourierWebhookAction,
  type CourierWebhookActionState
} from "../courier.actions";
import type { CourierWebhookView } from "../courier-webhook.service";

/**
 * Webhook setup, one card per connected carrier.
 *
 * The two values do different jobs and the copy says so, because a seller who
 * treats the URL as the secret will paste it into the wrong box: the URL routes
 * the callback to their store, the secret proves the caller is the courier.
 *
 * The secret is shown in full rather than hinted, unlike API credentials
 * elsewhere in courier settings. That is deliberate and safe — we generated it,
 * the carrier's panel is the only place it goes, and a value the seller cannot
 * read is a value they cannot configure.
 */

export function CourierWebhookCards({
  locked,
  webhooks
}: {
  locked: boolean;
  webhooks: CourierWebhookView[];
}) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  if (webhooks.length === 0) {
    return null;
  }

  return (
    <section className="grid gap-4">
      <div>
        <h2 className="m-0 flex flex-wrap items-center gap-2 text-base font-semibold text-[#20212a]">
          <RadioTower className="h-4 w-4 text-[#7548f5]" />
          Delivery auto-sync
          {locked ? <PaidBadge feature="order_tracking" interactive={false} showPlan /> : null}
        </h2>
        <p className="mt-2 mb-0 text-sm leading-6 text-[#737582]">
          Give the courier a callback URL and it will push every delivery update to your orders on
          its own — no Refresh, no polling. Until this is set up, a parcel&apos;s status only
          changes when someone asks for it.
        </p>
      </div>
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {webhooks.map((webhook) => (
          <WebhookCard
            key={webhook.provider}
            locked={locked}
            onLocked={() => setShowUpgrade(true)}
            webhook={webhook}
          />
        ))}
      </div>
      <PlanUpgradeDialog
        feature={showUpgrade ? "order_tracking" : null}
        onClose={() => setShowUpgrade(false)}
      />
    </section>
  );
}

function WebhookCard({
  locked,
  onLocked,
  webhook
}: {
  locked: boolean;
  onLocked: () => void;
  webhook: CourierWebhookView;
}) {
  const [state, setState] = useState<CourierWebhookActionState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [isPending, startTransition] = useTransition();

  // A freshly generated pair comes back on the action result; on a plain page
  // load it comes off the stored row. Preferring the action result is what makes
  // a regenerate show the new values without a reload.
  const url = state?.status === "success" ? state.url : webhook.url;
  const secret = state?.status === "success" ? state.secret : webhook.secret;
  const configured = Boolean(url);

  function run(action: () => Promise<CourierWebhookActionState>) {
    if (locked) {
      onLocked();
      return;
    }

    startTransition(async () => {
      const result = await action();

      if (result.lockedFeature) {
        onLocked();
        return;
      }

      setState(result);
      setRevealed(false);
    });
  }

  return (
    <article className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="grid">
          <h3 className="m-0 text-sm font-semibold text-[#20212a]">{webhook.providerLabel}</h3>
          <span className="text-[11px] text-[#858691]">
            {!webhook.supported
              ? "Webhooks not available"
              : configured
                ? webhook.lastSeenAt
                  ? `Last update received ${formatDate(webhook.lastSeenAt)}`
                  : "Waiting for the courier's first update"
                : "Not set up yet"}
          </span>
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
            configured
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : "border-[#e4e3ee] bg-[#faf9ff] text-[#777985]"
          }`}
        >
          {configured ? "Active" : "Off"}
        </span>
      </header>

      <p className="m-0 mb-4 text-[11px] leading-5 text-[#777985]">{webhook.setupHint}</p>

      {webhook.supported && configured ? (
        <div className="grid gap-3">
          <CopyField label="Callback URL" value={url ?? ""} />
          <CopyField
            label="Secret"
            onToggleReveal={() => setRevealed((current) => !current)}
            revealed={revealed}
            value={secret ?? ""}
          />
        </div>
      ) : null}

      {state?.message ? (
        <p className={`m-0 mt-3 rounded-lg px-3 py-2 text-[11px] leading-5 ${toneClass(state.status)}`}>
          {state.message}
        </p>
      ) : null}

      {webhook.supported ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#7548f5] px-4 text-[12px] font-semibold text-white transition hover:bg-[#6438e8] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            onClick={() => run(() => generateCourierWebhookAction(webhook.provider))}
            type="button"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {configured ? "Regenerate" : "Generate webhook URL"}
          </button>
          {configured ? (
            <button
              className="inline-flex h-9 items-center rounded-lg border border-[#dcd9e8] bg-white px-4 text-[12px] font-semibold text-[#5f616d] transition hover:border-[#bdb6da] hover:bg-[#faf9ff] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isPending}
              onClick={() => run(() => disableCourierWebhookAction(webhook.provider))}
              type="button"
            >
              Disable
            </button>
          ) : null}
        </div>
      ) : null}

      {configured ? (
        <p className="m-0 mt-3 text-[10px] leading-4 text-[#9a9bab]">
          Regenerating invalidates the current URL and secret immediately — re-paste both into the
          courier&apos;s panel or updates stop arriving.
        </p>
      ) : null}
    </article>
  );
}

function CopyField({
  label,
  onToggleReveal,
  revealed = true,
  value
}: {
  label: string;
  onToggleReveal?: (() => void) | undefined;
  revealed?: boolean | undefined;
  value: string;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <label className="grid gap-1.5">
      <span className="text-[11px] font-semibold text-[#5f616d]">{label}</span>
      <span className="flex items-stretch gap-1.5">
        <input
          className="h-9 min-w-0 flex-1 rounded-lg border border-[#e4e3ee] bg-[#faf9ff] px-3 font-mono text-[11px] text-[#30313d] outline-none"
          readOnly
          type={revealed ? "text" : "password"}
          value={value}
        />
        {onToggleReveal ? (
          <button
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#dcd9e8] bg-white text-[#5f616d] transition hover:border-[#bdb6da] hover:bg-[#faf9ff]"
            onClick={onToggleReveal}
            type="button"
          >
            {revealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        ) : null}
        <button
          aria-label={`Copy ${label}`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#dcd9e8] bg-white text-[#5f616d] transition hover:border-[#bdb6da] hover:bg-[#faf9ff]"
          onClick={() => {
            void navigator.clipboard?.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          type="button"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </span>
    </label>
  );
}

function toneClass(status: CourierWebhookActionState["status"]) {
  if (status === "success") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "warning") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
