"use client";

import { Globe2, Lock, Megaphone, Send, ServerCog } from "lucide-react";
import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
  type ComponentType
} from "react";
import { minPlanForFeature } from "../../admin/plan-catalog";
import { PaidBadge } from "../../billing/components/paid-badge";
import { PlanUpgradeDialog } from "../../billing/components/plan-upgrade-dialog";
import type { PlanFeatureKey } from "../../billing/plan-features";
import type { MarketingActionState, MarketingTestEventState } from "../marketing.actions";
import type { MarketingSettingsView } from "../marketing.schema";
import {
  DocLink,
  TrackingReadOnlyNotice,
  TrackingSaveBar,
  TrackingStatusBanner,
  trackingInputClass
} from "./tracking-fields";

/** The tier that unlocks this page, for the copy in its header. */
const serverSidePlan = minPlanForFeature("server_side_tracking");

/**
 * The two server-to-server senders.
 *
 * A page of their own rather than a block on the platform pages: every other
 * setting under Analytics & Tracking is an ID that ends up in a public script
 * tag, while these two hold an encrypted secret, run on our server, and are the
 * paid tier. Split across the Google and Meta pages, the plan boundary would run
 * through the middle of both and a seller would have no single thing to upgrade
 * *for*.
 */
export function ServerSideTrackingForm({
  action,
  canManage,
  locked,
  onSendGa4TestEvent,
  onSendMetaTestEvent,
  settings
}: {
  action: (state: MarketingActionState, formData: FormData) => Promise<MarketingActionState>;
  canManage: boolean;
  /** True when the store's plan does not include server-side tracking. */
  locked: boolean;
  onSendGa4TestEvent: () => Promise<MarketingTestEventState>;
  onSendMetaTestEvent: () => Promise<MarketingTestEventState>;
  settings: MarketingSettingsView;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle"
  } as MarketingActionState);
  const [capiEnabled, setCapiEnabled] = useState(settings.metaCapiEnabled);
  const [ga4MpEnabled, setGa4MpEnabled] = useState(settings.ga4MpEnabled);
  const [lockedFeature, setLockedFeature] = useState<PlanFeatureKey | null>(null);

  useEffect(() => {
    if (state.lockedFeature) {
      setLockedFeature(state.lockedFeature);
    }
  }, [state]);

  const activeChannels = Number(ga4MpEnabled) + Number(capiEnabled);

  return (
    <form action={formAction} className="grid gap-5" ref={formRef}>
      <PlanUpgradeDialog feature={lockedFeature} onClose={() => setLockedFeature(null)} />
      {!canManage ? <TrackingReadOnlyNotice /> : null}
      {state.lockedFeature ? null : (
        <TrackingStatusBanner message={state.message} status={state.status} />
      )}

      <section className="overflow-hidden rounded-xl border border-[#ddd4fb] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <header className="flex flex-wrap items-start gap-3 border-b border-[#e5e0f7] bg-[#f8f5ff] px-5 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ebe3ff] text-[#6d3cf5]">
            <ServerCog className="h-5 w-5" />
          </span>
          <span className="min-w-64 grow">
            <h2 className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#292a34]">
              Server-Side Tracking
              {locked ? (
                <PaidBadge feature="server_side_tracking" showPlan />
              ) : serverSidePlan ? (
                <span className="rounded-full bg-[#ebe3ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6d3cf5]">
                  {serverSidePlan}
                </span>
              ) : null}
            </h2>
            <span className="mt-1 block text-[11px] leading-5 text-[#858691]">
              The same purchases, sent from our server instead of the shopper&apos;s browser — so an
              ad blocker, a declined cookie banner, or an iOS privacy setting stops costing you the
              sale in your reports. Your pixels keep firing either way; this is the copy that always
              arrives.
            </span>
          </span>
          {/* A locked store can still have a channel switched on — it lapsed with
              one configured — so say "paused" rather than "on", which is what the
              send path actually does with it. */}
          {locked && activeChannels === 0 ? null : (
            <span
              className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${locked ? "bg-[#fdf1e3] text-[#a4651c] ring-1 ring-[#f4dcc0]" : activeChannels > 0 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-[#f2f1f7] text-[#7c7d8b]"}`}
            >
              {locked ? "Paused" : activeChannels > 0 ? `${activeChannels} of 2 on` : "Off"}
            </span>
          )}
        </header>

        {locked ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e0f7] bg-white px-5 py-4">
            <Lock className="h-4 w-4 shrink-0 text-[#6d3cf5]" />
            <p className="m-0 min-w-64 grow text-[11px] leading-5 text-[#655d78]">
              Your plan does not include server-side tracking, so nothing is sent from the server
              {activeChannels > 0 ? " — the settings below are kept, just paused" : ""}. Everything
              else under Analytics &amp; Tracking still works; only these two senders are held back
              {serverSidePlan ? ` until you move to ${serverSidePlan}` : ""}.
            </p>
            <button
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#7548f5] px-4 text-xs font-semibold text-white hover:bg-[#6436e8]"
              onClick={() => setLockedFeature("server_side_tracking")}
              type="button"
            >
              See what it unlocks
            </button>
          </div>
        ) : null}

        <div className="grid items-start gap-5 p-5 xl:grid-cols-2">
          <ServerSideChannel
            clearLabel="Remove stored secret"
            clearName="ga4ApiSecretCleared"
            disabled={!canManage}
            docHref="https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events"
            enabled={ga4MpEnabled}
            enabledName="ga4MpEnabled"
            error={state.fieldErrors?.ga4ApiSecret}
            hasSecret={settings.hasGa4ApiSecret}
            hint={settings.ga4ApiSecretHint}
            icon={Globe2}
            locked={locked}
            onEnabledChange={setGa4MpEnabled}
            onLocked={() => setLockedFeature("server_side_tracking")}
            onSendTest={onSendGa4TestEvent}
            replaceLabel="Replace secret"
            secretHelper="Admin → Data streams → your stream → Measurement Protocol API secrets → Create."
            secretLabel="Measurement Protocol API secret"
            secretName="ga4ApiSecret"
            secretPlaceholder="Admin → Data streams → Measurement Protocol"
            subtitle="Measurement Protocol"
            summary="Sends purchase to GA4 the moment the order is placed, against the Measurement ID on the Google Analytics page."
            title="Google Analytics 4"
          />
          <ServerSideChannel
            clearLabel="Remove stored token"
            clearName="metaCapiTokenCleared"
            disabled={!canManage}
            docHref="https://www.facebook.com/business/help/2041148702652965"
            enabled={capiEnabled}
            enabledName="metaCapiEnabled"
            error={state.fieldErrors?.metaCapiToken}
            hasSecret={settings.hasCapiToken}
            hint={settings.metaCapiTokenHint}
            icon={Megaphone}
            locked={locked}
            onEnabledChange={setCapiEnabled}
            onLocked={() => setLockedFeature("server_side_tracking")}
            onSendTest={onSendMetaTestEvent}
            replaceLabel="Replace token"
            secretHelper="Events Manager → Settings → Generate access token."
            secretLabel="Conversions API access token"
            secretName="metaCapiToken"
            secretPlaceholder="EAA…"
            subtitle="Conversions API"
            summary="Sends Purchase to Meta against the Pixel ID on the Meta Pixel page, deduplicated with the browser pixel."
            title="Meta"
          />
        </div>

        <div className="flex items-start gap-2 border-t border-[#eeeaf9] bg-[#fbfaff] px-5 py-4 text-[11px] leading-5 text-[#655d78]">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7548f5]" />
          <p className="m-0">
            Both credentials are encrypted before they are stored, never reach the browser, and
            never appear in your storefront HTML. Sending happens after the order is committed, so a
            rejected event can never fail a checkout — it lands in the activity log instead.
          </p>
        </div>
      </section>

      {canManage ? (
        <TrackingSaveBar isPending={isPending} onReset={() => formRef.current?.reset()} />
      ) : null}
    </form>
  );
}

/**
 * One server-to-server sender: a toggle, the encrypted credential, and a test
 * button. Owns its own replace/clear state; the parent tracks only the toggle,
 * which the header counts.
 *
 * Locking is applied to the toggle rather than to the whole panel, and only in
 * the direction that is actually gated: switching a channel *on* opens the
 * upgrade dialog instead, while switching one off, rotating a credential, and
 * removing one all keep working. A wholly disabled panel would strand a store
 * that lapsed with a channel already on — the checkbox it needs to turn off is
 * the checkbox it can no longer reach.
 */
function ServerSideChannel({
  clearLabel,
  clearName,
  disabled,
  docHref,
  enabled,
  enabledName,
  error,
  hasSecret,
  hint,
  icon: Icon,
  locked,
  onEnabledChange,
  onLocked,
  onSendTest,
  replaceLabel,
  secretHelper,
  secretLabel,
  secretName,
  secretPlaceholder,
  subtitle,
  summary,
  title
}: {
  clearLabel: string;
  clearName: string;
  disabled: boolean;
  docHref: string;
  enabled: boolean;
  enabledName: string;
  error: string | undefined;
  hasSecret: boolean;
  hint: string | null;
  icon: ComponentType<{ className?: string }>;
  locked: boolean;
  onEnabledChange: (next: boolean) => void;
  onLocked: () => void;
  onSendTest: () => Promise<MarketingTestEventState>;
  replaceLabel: string;
  secretHelper: string;
  secretLabel: string;
  secretName: string;
  secretPlaceholder: string;
  subtitle: string;
  summary: string;
  title: string;
}) {
  const [replacing, setReplacing] = useState(!hasSecret);
  const [cleared, setCleared] = useState(false);

  return (
    <div
      className={`grid gap-3 rounded-lg border p-4 ${locked ? "border-[#eae7f5] bg-[#fbfaff]" : "border-[#e5e0f7] bg-[#faf9ff]"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <Icon className={`h-4 w-4 shrink-0 ${locked ? "text-[#a8a3bd]" : "text-[#6d3cf5]"}`} />
          <span>
            <span className="block text-sm font-semibold text-[#292a34]">{title}</span>
            <span className="block text-[11px] text-[#858691]">{subtitle}</span>
          </span>
        </span>
        <label
          className={`flex shrink-0 items-center gap-2 text-xs font-semibold ${locked ? "text-[#8b8c99]" : "text-[#33343e]"}`}
          title={locked && serverSidePlan ? `Included from the ${serverSidePlan} plan.` : undefined}
        >
          <input
            checked={enabled}
            className="h-4 w-4 accent-[#7548f5]"
            disabled={disabled}
            name={enabledName}
            onChange={(event) => {
              // Switching on is the gated half; the controlled `checked` puts the
              // box straight back and the dialog explains why.
              if (locked && event.target.checked) {
                onLocked();
                return;
              }

              onEnabledChange(event.target.checked);
            }}
            type="checkbox"
          />
          Enable
        </label>
      </div>

      <p className="m-0 text-[11px] leading-5 text-[#655d78]">{summary}</p>

      {hasSecret && !locked ? <TestEventButton disabled={disabled} onSend={onSendTest} /> : null}

      {hasSecret && !replacing ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-md border border-[#dedcea] bg-white px-3 py-2 font-mono text-xs text-[#33343e]">
            {hint ?? "••••"}
          </span>
          <button
            className="text-xs font-semibold text-[#7548f5] hover:underline disabled:text-[#a2a3b0] disabled:no-underline"
            disabled={disabled}
            onClick={() => setReplacing(true)}
            type="button"
          >
            {replaceLabel}
          </button>
          <label className="flex items-center gap-2 text-xs text-[#655d78]">
            <input
              checked={cleared}
              className="h-3.5 w-3.5 accent-[#e11d48]"
              disabled={disabled}
              name={clearName}
              onChange={(event) => setCleared(event.target.checked)}
              type="checkbox"
            />
            {clearLabel}
          </label>
        </div>
      ) : (
        <label className="grid gap-2 text-sm font-medium text-[#33343e]">
          {secretLabel}
          <input
            autoComplete="off"
            className={trackingInputClass}
            disabled={disabled}
            name={secretName}
            placeholder={secretPlaceholder}
            spellCheck={false}
            type="password"
          />
          {error ? (
            <span className="text-[11px] font-medium text-rose-600">{error}</span>
          ) : (
            <span className="text-[11px] font-normal leading-5 text-[#858691]">
              {secretHelper} <DocLink href={docHref} />
            </span>
          )}
        </label>
      )}
    </div>
  );
}

/**
 * Fires a real event with the *stored* secret, so a seller can prove the
 * credentials work before a customer places an order. Holds its own result
 * state — Meta and GA4 each have one, and they report independently.
 */
function TestEventButton({
  disabled,
  onSend
}: {
  disabled: boolean;
  onSend: () => Promise<MarketingTestEventState>;
}) {
  const [result, setResult] = useState<MarketingTestEventState | null>(null);
  const [isSending, startSend] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-3 text-xs font-semibold text-[#555762] hover:bg-[#f8f7fc] disabled:opacity-60"
        disabled={disabled || isSending}
        onClick={() =>
          startSend(async () => {
            setResult(await onSend());
          })
        }
        type="button"
      >
        <Send className="h-3.5 w-3.5" />
        {isSending ? "Sending..." : "Send test event"}
      </button>
      {result ? (
        <span
          className={`text-[11px] font-medium ${result.ok ? "text-emerald-700" : "text-rose-600"}`}
        >
          {result.message}
        </span>
      ) : (
        <span className="text-[11px] text-[#858691]">Uses the saved credentials.</span>
      )}
    </div>
  );
}
