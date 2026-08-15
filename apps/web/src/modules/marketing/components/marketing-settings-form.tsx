"use client";

import { AlertTriangle, BarChart3, Code2, ExternalLink, Globe2, Lock, Megaphone, Music2, RotateCcw, Save, Send, ShieldCheck } from "lucide-react";
import { useActionState, useRef, useState, useTransition, type ComponentType, type ReactNode } from "react";
import type { MarketingActionState, MetaTestEventState } from "../marketing.actions";
import { marketingIdHints, type MarketingIdField } from "../marketing.schema";
import type { MarketingSettingsView } from "../marketing.schema";

const inputClass =
  "h-11 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 font-mono text-sm text-[#292a34] outline-none placeholder:font-sans placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f5fa] disabled:text-[#8b8c99]";
const textareaClass =
  "min-h-32 w-full resize-y rounded-lg border border-[#dedcea] bg-white px-3.5 py-3 font-mono text-xs leading-5 text-[#292a34] outline-none placeholder:font-sans placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f5fa] disabled:text-[#8b8c99]";

const initialState: MarketingActionState = { status: "idle" };

export function MarketingSettingsForm({
  action,
  canManage,
  onSendTestEvent,
  settings
}: {
  action: (state: MarketingActionState, formData: FormData) => Promise<MarketingActionState>;
  canManage: boolean;
  onSendTestEvent: () => Promise<MetaTestEventState>;
  settings: MarketingSettingsView;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [customEnabled, setCustomEnabled] = useState(settings.customEnabled);
  const [capiEnabled, setCapiEnabled] = useState(settings.metaCapiEnabled);
  const [replacingToken, setReplacingToken] = useState(!settings.hasCapiToken);
  const [clearToken, setClearToken] = useState(false);
  const [testResult, setTestResult] = useState<MetaTestEventState | null>(null);
  const [isTesting, startTest] = useTransition();
  const disabled = !canManage;

  return (
    <form action={formAction} className="grid gap-5" ref={formRef}>
      {state.status === "success" ? (
        <p className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{state.message}</p>
      ) : null}
      {state.status === "error" ? (
        <p className="m-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{state.message}</p>
      ) : null}

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <MarketingCard icon={Globe2} subtitle="Analytics and Tag Manager" title="Google">
          <IdField disabled={disabled} docHref="https://support.google.com/analytics/answer/9539598" error={state.fieldErrors?.ga4MeasurementId} field="ga4MeasurementId" helper="Found in Google Analytics under Admin → Data streams." label="GA4 Measurement ID" value={settings.ga4MeasurementId} />
          <IdField disabled={disabled} docHref="https://support.google.com/tagmanager/answer/6103696" error={state.fieldErrors?.gtmContainerId} field="gtmContainerId" helper="Found at the top of your Tag Manager workspace." label="GTM Container ID" value={settings.gtmContainerId} />
          <IdField disabled={disabled} docHref="https://search.google.com/search-console" error={state.fieldErrors?.googleSiteVerification} field="googleSiteVerification" helper="The content value only — paste the whole meta tag and we will pull it out." label="Google Verification" value={settings.googleSiteVerification} />
        </MarketingCard>

        <MarketingCard icon={Megaphone} subtitle="Pixel, Conversions API, and domain verification" title="Meta">
          <IdField disabled={disabled} docHref="https://www.facebook.com/business/help/952192354843755" error={state.fieldErrors?.metaPixelId} field="metaPixelId" helper="Events Manager → Data sources. Digits only." label="Pixel ID" value={settings.metaPixelId} />

          <div className="grid gap-3 rounded-lg border border-[#e5e0f7] bg-[#faf9ff] p-4">
            <label className="flex items-center gap-2.5 text-sm font-medium text-[#33343e]">
              <input checked={capiEnabled} className="h-4 w-4 accent-[#7548f5]" disabled={disabled} name="metaCapiEnabled" onChange={(event) => setCapiEnabled(event.target.checked)} type="checkbox" />
              Enable Conversions API
            </label>
            <p className="m-0 flex items-start gap-2 text-[11px] leading-5 text-[#655d78]">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7548f5]" />
              Server-side only. The token is encrypted before it is stored, is never sent to the browser, and never appears in your storefront HTML.
            </p>

            {settings.hasCapiToken ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-3 text-xs font-semibold text-[#555762] hover:bg-[#f8f7fc] disabled:opacity-60"
                  disabled={disabled || isTesting}
                  onClick={() =>
                    startTest(async () => {
                      setTestResult(await onSendTestEvent());
                    })
                  }
                  type="button"
                >
                  <Send className="h-3.5 w-3.5" />
                  {isTesting ? "Sending..." : "Send test event"}
                </button>
                {testResult ? (
                  <span
                    className={`text-[11px] font-medium ${testResult.ok ? "text-emerald-700" : "text-rose-600"}`}
                  >
                    {testResult.message}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#858691]">Uses the saved token.</span>
                )}
              </div>
            ) : null}

            {settings.hasCapiToken && !replacingToken ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-md border border-[#dedcea] bg-white px-3 py-2 font-mono text-xs text-[#33343e]">{settings.metaCapiTokenHint ?? "••••"}</span>
                <button className="text-xs font-semibold text-[#7548f5] hover:underline disabled:text-[#a2a3b0]" disabled={disabled} onClick={() => setReplacingToken(true)} type="button">Replace token</button>
                <label className="flex items-center gap-2 text-xs text-[#655d78]">
                  <input checked={clearToken} className="h-3.5 w-3.5 accent-[#e11d48]" disabled={disabled} name="metaCapiTokenCleared" onChange={(event) => setClearToken(event.target.checked)} type="checkbox" />
                  Remove stored token
                </label>
              </div>
            ) : (
              <label className="grid gap-2 text-sm font-medium text-[#33343e]">
                Conversions API access token
                <input autoComplete="off" className={inputClass} disabled={disabled} name="metaCapiToken" placeholder="EAA…" spellCheck={false} type="password" />
                {state.fieldErrors?.metaCapiToken ? (
                  <span className="text-[11px] font-medium text-rose-600">{state.fieldErrors.metaCapiToken}</span>
                ) : (
                  <span className="text-[11px] font-normal leading-5 text-[#858691]">Events Manager → Settings → Generate access token. <DocLink href="https://www.facebook.com/business/help/2041148702652965" /></span>
                )}
              </label>
            )}
          </div>

          <IdField disabled={disabled} error={state.fieldErrors?.metaDomainVerification} field="metaDomainVerification" helper="The content value only, from Business Manager → Brand safety → Domains." label="Domain Verification" value={settings.metaDomainVerification} />
        </MarketingCard>

        <MarketingCard icon={Music2} subtitle="TikTok Ads pixel" title="TikTok">
          <IdField disabled={disabled} docHref="https://ads.tiktok.com/help/article/get-started-pixel" error={state.fieldErrors?.tiktokPixelId} field="tiktokPixelId" helper="TikTok Ads Manager → Assets → Events. 20 characters." label="Pixel ID" value={settings.tiktokPixelId} />
        </MarketingCard>

        <MarketingCard icon={BarChart3} subtitle="Conversion tracking for Google Ads" title="Google Ads">
          <IdField disabled={disabled} docHref="https://support.google.com/google-ads/answer/6331304" error={state.fieldErrors?.googleAdsConversionId} field="googleAdsConversionId" helper="Google Ads → Goals → Conversions. Starts with AW-." label="Conversion ID" value={settings.googleAdsConversionId} />
        </MarketingCard>
      </div>

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
