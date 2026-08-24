"use client";

import { AlertTriangle, BarChart3, Code2, ExternalLink, Globe2, Lock, Megaphone, Music2, RotateCcw, Save, Send, ServerCog, ShieldCheck } from "lucide-react";
import { useActionState, useEffect, useRef, useState, useTransition, type ComponentType, type ReactNode } from "react";
import { minPlanForFeature } from "../../admin/plan-catalog";
import { PaidBadge } from "../../billing/components/paid-badge";
import { PlanUpgradeDialog } from "../../billing/components/plan-upgrade-dialog";
import type { PlanFeatureKey } from "../../billing/plan-features";
import type { MarketingActionState, MarketingTestEventState } from "../marketing.actions";
import { marketingIdHints, type MarketingIdField } from "../marketing.schema";
import type { MarketingSettingsView } from "../marketing.schema";

const inputClass =
  "h-11 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 font-mono text-sm text-[#292a34] outline-none placeholder:font-sans placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f5fa] disabled:text-[#8b8c99]";
const textareaClass =
  "min-h-32 w-full resize-y rounded-lg border border-[#dedcea] bg-white px-3.5 py-3 font-mono text-xs leading-5 text-[#292a34] outline-none placeholder:font-sans placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f5fa] disabled:text-[#8b8c99]";

const initialState: MarketingActionState = { status: "idle" };

/** The tier that unlocks the server-side block, for the copy in its header. */
const serverSidePlan = minPlanForFeature("server_side_tracking");

export function MarketingSettingsForm({
  action,
  canManage,
  onSendGa4TestEvent,
  onSendMetaTestEvent,
  serverSideLocked,
  settings
}: {
  action: (state: MarketingActionState, formData: FormData) => Promise<MarketingActionState>;
  canManage: boolean;
  onSendGa4TestEvent: () => Promise<MarketingTestEventState>;
  onSendMetaTestEvent: () => Promise<MarketingTestEventState>;
  /** True when the store's plan does not include server-side tracking. */
  serverSideLocked: boolean;
  settings: MarketingSettingsView;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [customEnabled, setCustomEnabled] = useState(settings.customEnabled);
  const [capiEnabled, setCapiEnabled] = useState(settings.metaCapiEnabled);
  const [ga4MpEnabled, setGa4MpEnabled] = useState(settings.ga4MpEnabled);
  const [lockedFeature, setLockedFeature] = useState<PlanFeatureKey | null>(null);
  const disabled = !canManage;

  // `useActionState` hands back a fresh object per submit, so re-submitting after
  // dismissing the dialog re-opens it.
  useEffect(() => {
    if (state.lockedFeature) {
      setLockedFeature(state.lockedFeature);
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-5" ref={formRef}>
      <PlanUpgradeDialog feature={lockedFeature} onClose={() => setLockedFeature(null)} />
      {state.status === "success" ? (
        <p className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{state.message}</p>
      ) : null}
      {state.status === "error" && !state.lockedFeature ? (
        <p className="m-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{state.message}</p>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <MarketingCard icon={Globe2} subtitle="Analytics and Tag Manager" title="Google">
          <IdField disabled={disabled} docHref="https://support.google.com/analytics/answer/9539598" error={state.fieldErrors?.ga4MeasurementId} field="ga4MeasurementId" helper="Found in Google Analytics under Admin → Data streams." label="GA4 Measurement ID" value={settings.ga4MeasurementId} />
          <IdField disabled={disabled} docHref="https://support.google.com/tagmanager/answer/6103696" error={state.fieldErrors?.gtmContainerId} field="gtmContainerId" helper="Found at the top of your Tag Manager workspace." label="GTM Container ID" value={settings.gtmContainerId} />
          <IdField disabled={disabled} docHref="https://search.google.com/search-console" error={state.fieldErrors?.googleSiteVerification} field="googleSiteVerification" helper="The content value only — paste the whole meta tag and we will pull it out." label="Google Verification" value={settings.googleSiteVerification} />
        </MarketingCard>

        <MarketingCard icon={Megaphone} subtitle="Pixel and domain verification" title="Meta">
          <IdField disabled={disabled} docHref="https://www.facebook.com/business/help/952192354843755" error={state.fieldErrors?.metaPixelId} field="metaPixelId" helper="Events Manager → Data sources. Digits only." label="Pixel ID" value={settings.metaPixelId} />
          <IdField disabled={disabled} error={state.fieldErrors?.metaDomainVerification} field="metaDomainVerification" helper="The content value only, from Business Manager → Brand safety → Domains." label="Domain Verification" value={settings.metaDomainVerification} />
        </MarketingCard>

        <MarketingCard icon={Music2} subtitle="TikTok Ads pixel" title="TikTok">
          <IdField disabled={disabled} docHref="https://ads.tiktok.com/help/article/get-started-pixel" error={state.fieldErrors?.tiktokPixelId} field="tiktokPixelId" helper="TikTok Ads Manager → Assets → Events. 20 characters." label="Pixel ID" value={settings.tiktokPixelId} />
        </MarketingCard>

        <MarketingCard icon={BarChart3} subtitle="Conversion tracking for Google Ads" title="Google Ads">
          <IdField disabled={disabled} docHref="https://support.google.com/google-ads/answer/6331304" error={state.fieldErrors?.googleAdsConversionId} field="googleAdsConversionId" helper="Google Ads → Goals → Conversions. Starts with AW-." label="Conversion ID" value={settings.googleAdsConversionId} />
        </MarketingCard>
      </div>

      <ServerSideTrackingSection
        canManage={canManage}
        capiEnabled={capiEnabled}
        fieldErrors={state.fieldErrors}
        ga4MpEnabled={ga4MpEnabled}
        locked={serverSideLocked}
        onCapiEnabledChange={setCapiEnabled}
        onGa4MpEnabledChange={setGa4MpEnabled}
        onLocked={() => setLockedFeature("server_side_tracking")}
        onSendGa4TestEvent={onSendGa4TestEvent}
        onSendMetaTestEvent={onSendMetaTestEvent}
        settings={settings}
      />

      <section className="overflow-hidden rounded-xl border border-[#f0d9c4] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <header className="flex items-start gap-3 border-b border-[#f4e6d8] bg-[#fffaf4] px-5 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#fdeed9] text-[#b45309]"><Code2 className="h-5 w-5" /></span>
          <span className="grow">
            <h2 className="m-0 text-sm font-semibold text-[#292a34]">Custom Tracking <span className="ml-1.5 rounded-full bg-[#fdeed9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#b45309]">Advanced</span></h2>
            <span className="mt-1 block text-[11px] text-[#858691]">The only place that still takes raw code. Everything above is generated from a template.</span>
          </span>
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#33343e]">
            <input checked={customEnabled} className="h-4 w-4 accent-[#b45309]" disabled={disabled} name="customEnabled" onChange={(event) => setCustomEnabled(event.target.checked)} type="checkbox" />
            Enable
          </label>
        </header>
        <div className="grid gap-5 p-5">
          <p className="m-0 flex items-start gap-2 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-[11px] leading-5 text-[#8a6134]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Only tracking tags are accepted: <code>script</code>, <code>noscript</code>, <code>meta</code>, <code>img</code>, <code>iframe</code>, <code>link</code>, <code>style</code>, loading from your own domain or a known analytics host. Inline event handlers, <code>javascript:</code> URLs, <code>document.write</code>, and <code>eval()</code> are rejected at save.
          </p>
          <CodeField disabled={disabled || !customEnabled} error={state.fieldErrors?.customHeaderCode} helper="Injected into <head>." label="Header" name="customHeaderCode" value={settings.customHeaderCode} />
          <CodeField disabled={disabled || !customEnabled} error={state.fieldErrors?.customBodyCode} helper="Injected immediately after <body> opens." label="Body" name="customBodyCode" value={settings.customBodyCode} />
          <CodeField disabled={disabled || !customEnabled} error={state.fieldErrors?.customFooterCode} helper="Injected just before </body>." label="Footer" name="customFooterCode" value={settings.customFooterCode} />
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-xl border border-[#e5e0f7] bg-[#f7f4ff] px-4 py-3 text-xs leading-5 text-[#655d78]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7548f5]" />
        These tags load on your storefront only — never on your dashboard, so your own admin activity is not tracked. Changes go live on the next page load, and every change here is recorded in the store activity log with who made it.
      </aside>

      {canManage ? (
        <div className="flex flex-wrap justify-end gap-3">
          <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-4 text-sm font-semibold text-[#555762] hover:bg-[#f8f7fc]" onClick={() => formRef.current?.reset()} type="button"><RotateCcw className="h-4 w-4" />Reset</button>
          <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6436e8] disabled:opacity-60" disabled={isPending} type="submit"><Save className="h-4 w-4" />{isPending ? "Saving..." : "Save Marketing Settings"}</button>
        </div>
      ) : null}
    </form>
  );
}

/**
 * The two server-to-server senders, lifted out of the Google and Meta cards into
 * a block of their own.
 *
 * They belong together and apart from everything else on this page: every other
 * field here is an ID that ends up in a public script tag, while these two hold
 * an encrypted secret, run on our server, and are the paid tier of this page.
 * Left inside the platform cards, the plan boundary ran through the middle of
 * two cards and a seller had no single thing to upgrade *for*.
 */
function ServerSideTrackingSection({
  canManage,
  capiEnabled,
  fieldErrors,
  ga4MpEnabled,
  locked,
  onCapiEnabledChange,
  onGa4MpEnabledChange,
  onLocked,
  onSendGa4TestEvent,
  onSendMetaTestEvent,
  settings
}: {
  canManage: boolean;
  capiEnabled: boolean;
  fieldErrors: Record<string, string> | undefined;
  ga4MpEnabled: boolean;
  locked: boolean;
  onCapiEnabledChange: (next: boolean) => void;
  onGa4MpEnabledChange: (next: boolean) => void;
  onLocked: () => void;
  onSendGa4TestEvent: () => Promise<MarketingTestEventState>;
  onSendMetaTestEvent: () => Promise<MarketingTestEventState>;
  settings: MarketingSettingsView;
}) {
  const activeChannels = Number(ga4MpEnabled) + Number(capiEnabled);

  return (
    <section className="overflow-hidden rounded-xl border border-[#ddd4fb] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="flex flex-wrap items-start gap-3 border-b border-[#e5e0f7] bg-[#f8f5ff] px-5 py-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#ebe3ff] text-[#6d3cf5]"><ServerCog className="h-5 w-5" /></span>
        <span className="min-w-64 grow">
          <h2 className="m-0 flex flex-wrap items-center gap-2 text-sm font-semibold text-[#292a34]">
            Server-Side Tracking
            {locked ? (
              <PaidBadge feature="server_side_tracking" showPlan />
            ) : serverSidePlan ? (
              <span className="rounded-full bg-[#ebe3ff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6d3cf5]">{serverSidePlan}</span>
            ) : null}
          </h2>
          <span className="mt-1 block text-[11px] leading-5 text-[#858691]">
            The same purchases, sent from our server instead of the shopper&apos;s browser — so an ad blocker, a declined cookie banner, or an iOS privacy setting stops costing you the sale in your reports. The pixels above keep firing either way; this is the copy that always arrives.
          </span>
        </span>
        {/* A locked store can still have a channel switched on — it lapsed with
            one configured — so say "paused" rather than "on", which is what the
            send path actually does with it. */}
        {locked && activeChannels === 0 ? null : (
          <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-wide ${locked ? "bg-[#fdf1e3] text-[#a4651c] ring-1 ring-[#f4dcc0]" : activeChannels > 0 ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" : "bg-[#f2f1f7] text-[#7c7d8b]"}`}>
            {locked ? "Paused" : activeChannels > 0 ? `${activeChannels} of 2 on` : "Off"}
          </span>
        )}
      </header>

      {locked ? (
        <div className="flex flex-wrap items-center gap-3 border-b border-[#e5e0f7] bg-white px-5 py-4">
          <Lock className="h-4 w-4 shrink-0 text-[#6d3cf5]" />
          <p className="m-0 min-w-64 grow text-[11px] leading-5 text-[#655d78]">
            Your plan does not include server-side tracking, so nothing is sent from the server{activeChannels > 0 ? " — the settings below are kept, just paused" : ""}. Everything else on this page still works; only these two senders are held back{serverSidePlan ? ` until you move to ${serverSidePlan}` : ""}.
          </p>
          <button className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-[#7548f5] px-4 text-xs font-semibold text-white hover:bg-[#6436e8]" onClick={onLocked} type="button">
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
          error={fieldErrors?.ga4ApiSecret}
          hasSecret={settings.hasGa4ApiSecret}
          hint={settings.ga4ApiSecretHint}
          icon={Globe2}
          locked={locked}
          onEnabledChange={onGa4MpEnabledChange}
          onLocked={onLocked}
          onSendTest={onSendGa4TestEvent}
          replaceLabel="Replace secret"
          secretHelper="Admin → Data streams → your stream → Measurement Protocol API secrets → Create."
          secretLabel="Measurement Protocol API secret"
          secretName="ga4ApiSecret"
          secretPlaceholder="Admin → Data streams → Measurement Protocol"
          subtitle="Measurement Protocol"
          summary="Sends purchase to GA4 the moment the order is placed, against the Measurement ID in the Google card above."
          title="Google Analytics 4"
        />
        <ServerSideChannel
          clearLabel="Remove stored token"
          clearName="metaCapiTokenCleared"
          disabled={!canManage}
          docHref="https://www.facebook.com/business/help/2041148702652965"
          enabled={capiEnabled}
          enabledName="metaCapiEnabled"
          error={fieldErrors?.metaCapiToken}
          hasSecret={settings.hasCapiToken}
          hint={settings.metaCapiTokenHint}
          icon={Megaphone}
          locked={locked}
          onEnabledChange={onCapiEnabledChange}
          onLocked={onLocked}
          onSendTest={onSendMetaTestEvent}
          replaceLabel="Replace token"
          secretHelper="Events Manager → Settings → Generate access token."
          secretLabel="Conversions API access token"
          secretName="metaCapiToken"
          secretPlaceholder="EAA…"
          subtitle="Conversions API"
          summary="Sends Purchase to Meta against the Pixel ID in the Meta card above, deduplicated with the browser pixel."
          title="Meta"
        />
      </div>

      <p className="m-0 flex items-start gap-2 border-t border-[#eeeaf9] bg-[#fbfaff] px-5 py-4 text-[11px] leading-5 text-[#655d78]">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7548f5]" />
        Both credentials are encrypted before they are stored, never reach the browser, and never appear in your storefront HTML. Sending happens after the order is committed, so a rejected event can never fail a checkout — it lands in the activity log instead.
      </p>
    </section>
  );
}

/**
 * One server-to-server sender: a toggle, the encrypted credential, and a test
 * button. Owns its own replace/clear state; the parent tracks only the toggle,
 * which the section header counts.
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
    <div className={`grid gap-3 rounded-lg border p-4 ${locked ? "border-[#eae7f5] bg-[#fbfaff]" : "border-[#e5e0f7] bg-[#faf9ff]"}`}>
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
          <span className="rounded-md border border-[#dedcea] bg-white px-3 py-2 font-mono text-xs text-[#33343e]">{hint ?? "••••"}</span>
          <button className="text-xs font-semibold text-[#7548f5] hover:underline disabled:text-[#a2a3b0] disabled:no-underline" disabled={disabled} onClick={() => setReplacing(true)} type="button">{replaceLabel}</button>
          <label className="flex items-center gap-2 text-xs text-[#655d78]">
            <input checked={cleared} className="h-3.5 w-3.5 accent-[#e11d48]" disabled={disabled} name={clearName} onChange={(event) => setCleared(event.target.checked)} type="checkbox" />
            {clearLabel}
          </label>
        </div>
      ) : (
        <label className="grid gap-2 text-sm font-medium text-[#33343e]">
          {secretLabel}
          <input autoComplete="off" className={inputClass} disabled={disabled} name={secretName} placeholder={secretPlaceholder} spellCheck={false} type="password" />
          {error ? (
            <span className="text-[11px] font-medium text-rose-600">{error}</span>
          ) : (
            <span className="text-[11px] font-normal leading-5 text-[#858691]">{secretHelper} <DocLink href={docHref} /></span>
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

function IdField({ disabled, docHref, error, field, helper, label, value }: {
  disabled: boolean;
  docHref?: string | undefined;
  error: string | undefined;
  field: MarketingIdField;
  helper: string;
  label: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#33343e]">
      {label}
      <input autoComplete="off" className={inputClass} defaultValue={value} disabled={disabled} name={field} placeholder={marketingIdHints[field].example} spellCheck={false} type="text" />
      {error ? (
        <span className="text-[11px] font-medium text-rose-600">{error} {docHref ? <DocLink href={docHref} /> : null}</span>
      ) : (
        <span className="text-[11px] font-normal leading-5 text-[#858691]">{helper} {docHref ? <DocLink href={docHref} /> : null}</span>
      )}
    </label>
  );
}

function DocLink({ href }: { href: string }) {
  return (
    <a className="dash-doc-link inline-flex items-center gap-1 whitespace-nowrap font-medium" href={href} rel="noreferrer" target="_blank">
      Where to find this
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

function CodeField({ disabled, error, helper, label, name, value }: {
  disabled: boolean;
  error: string | undefined;
  helper: string;
  label: string;
  name: string;
  value: string;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#33343e]">
      {label}
      <textarea className={textareaClass} defaultValue={value} disabled={disabled} name={name} spellCheck={false} />
      {error ? (
        <span className="text-[11px] font-medium text-rose-600">{error}</span>
      ) : (
        <span className="text-[11px] font-normal leading-5 text-[#858691]">{helper}</span>
      )}
    </label>
  );
}

function MarketingCard({ children, icon: Icon, subtitle, title }: {
  children: ReactNode;
  icon: ComponentType<{ className?: string }>;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="flex items-center gap-3 border-b border-[#ececf5] px-5 py-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#f0ebff] text-[#7548f5]"><Icon className="h-5 w-5" /></span>
        <span><h2 className="m-0 text-sm font-semibold text-[#292a34]">{title}</h2><span className="mt-1 block text-[11px] text-[#858691]">{subtitle}</span></span>
      </header>
      <div className="grid gap-5 p-5">{children}</div>
    </section>
  );
}
