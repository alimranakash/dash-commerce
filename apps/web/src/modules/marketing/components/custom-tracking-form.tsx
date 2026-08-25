"use client";

import { AlertTriangle, Code2, ShieldCheck } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { PlanUpgradeDialog } from "../../billing/components/plan-upgrade-dialog";
import type { PlanFeatureKey } from "../../billing/plan-features";
import type { MarketingActionState } from "../marketing.actions";
import type { MarketingSettingsView } from "../marketing.schema";
import {
  CodeField,
  TrackingReadOnlyNotice,
  TrackingSaveBar,
  TrackingStatusBanner
} from "./tracking-fields";

/**
 * The only page that still accepts raw markup. Everything else is generated
 * from a per-platform template, which is why this one carries a warning and its
 * own allowlist.
 */
export function CustomTrackingForm({
  action,
  canManage,
  settings
}: {
  action: (state: MarketingActionState, formData: FormData) => Promise<MarketingActionState>;
  canManage: boolean;
  settings: MarketingSettingsView;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, {
    status: "idle"
  } as MarketingActionState);
  const [customEnabled, setCustomEnabled] = useState(settings.customEnabled);
  const [lockedFeature, setLockedFeature] = useState<PlanFeatureKey | null>(null);
  const disabled = !canManage;

  useEffect(() => {
    if (state.lockedFeature) {
      setLockedFeature(state.lockedFeature);
    }
  }, [state]);

  return (
    <form action={formAction} className="grid max-w-3xl gap-5" ref={formRef}>
      <PlanUpgradeDialog feature={lockedFeature} onClose={() => setLockedFeature(null)} />
      {!canManage ? <TrackingReadOnlyNotice /> : null}
      {state.lockedFeature ? null : (
        <TrackingStatusBanner message={state.message} status={state.status} />
      )}

      <section className="overflow-hidden rounded-xl border border-[#f0d9c4] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <header className="flex items-start gap-3 border-b border-[#f4e6d8] bg-[#fffaf4] px-5 py-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#fdeed9] text-[#b45309]">
            <Code2 className="h-5 w-5" />
          </span>
          <span className="grow">
            <h2 className="m-0 text-sm font-semibold text-[#292a34]">
              Custom Tracking
              <span className="ml-1.5 rounded-full bg-[#fdeed9] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#b45309]">
                Advanced
              </span>
            </h2>
            <span className="mt-1 block text-[11px] text-[#858691]">
              The only page that takes raw code. Every other platform here is generated from a
              template.
            </span>
          </span>
          <label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-[#33343e]">
            <input
              checked={customEnabled}
              className="h-4 w-4 accent-[#b45309]"
              disabled={disabled}
              name="customEnabled"
              onChange={(event) => setCustomEnabled(event.target.checked)}
              type="checkbox"
            />
            Enable
          </label>
        </header>
        <div className="grid gap-5 p-5">
          {/* The flex container is the div, not the paragraph. Making the <p>
              itself a flex parent turns every run of text between the <code>
              tags into its own flex item, and they stack into narrow columns
              instead of wrapping as one sentence. */}
          <div className="flex items-start gap-2 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-[11px] leading-5 text-[#8a6134]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p className="m-0">
              Only tracking tags are accepted: <code>script</code>, <code>noscript</code>,{" "}
              <code>meta</code>, <code>img</code>, <code>iframe</code>, <code>link</code>,{" "}
              <code>style</code>, loading from your own domain or a known analytics host. Inline
              event handlers, <code>javascript:</code> URLs, <code>document.write</code>, and{" "}
              <code>eval()</code> are rejected at save.
            </p>
          </div>
          <CodeField
            disabled={disabled || !customEnabled}
            error={state.fieldErrors?.customHeaderCode}
            helper="Injected into <head>."
            label="Header"
            name="customHeaderCode"
            value={settings.customHeaderCode}
          />
          <CodeField
            disabled={disabled || !customEnabled}
            error={state.fieldErrors?.customBodyCode}
            helper="Injected immediately after <body> opens."
            label="Body"
            name="customBodyCode"
            value={settings.customBodyCode}
          />
          <CodeField
            disabled={disabled || !customEnabled}
            error={state.fieldErrors?.customFooterCode}
            helper="Injected just before </body>."
            label="Footer"
            name="customFooterCode"
            value={settings.customFooterCode}
          />
        </div>
      </section>

      <aside className="flex items-start gap-3 rounded-xl border border-[#e5e0f7] bg-[#f7f4ff] px-4 py-3 text-xs leading-5 text-[#655d78]">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#7548f5]" />
        <p className="m-0">
          These tags load on your storefront only — never on your dashboard, so your own admin
          activity is not tracked. Changes go live on the next page load, and every change here is
          recorded in the store activity log with who made it.
        </p>
      </aside>

      {canManage ? (
        <TrackingSaveBar isPending={isPending} onReset={() => formRef.current?.reset()} />
      ) : null}
    </form>
  );
}
