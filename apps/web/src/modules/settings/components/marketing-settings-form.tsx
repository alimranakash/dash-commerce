"use client";

import { BarChart3, Globe2, MessageSquare, RotateCcw, Save } from "lucide-react";
import { useActionState, useRef, type ComponentType, type ReactNode } from "react";
import type { SettingsActionState } from "../settings.actions";
import type { MarketingSettingsInput } from "../settings.schema";

const marketingTextareaClass = "min-h-36 w-full resize-y rounded-lg border border-[#dedcea] bg-white px-3.5 py-3 font-mono text-xs font-normal leading-5 text-[#292a34] outline-none placeholder:font-sans placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10";

const initialState: SettingsActionState = { status: "idle" };

export function MarketingSettingsForm({ action, settings }: {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  settings: MarketingSettingsInput;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-5" ref={formRef}>
      {state.status === "success" ? <p className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{state.message}</p> : null}
      {state.status === "error" ? <p className="m-0 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{state.message}</p> : null}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <MarketingCard icon={MessageSquare} subtitle="Meta Pixel and ownership verification" title="Facebook / Meta Tracking">
          <MarketingField helper="Paste your Meta Pixel script or pixel ID." label="Facebook Pixel Code">
            <textarea className={marketingTextareaClass} defaultValue={settings.facebookPixelCode ?? ""} name="facebookPixelCode" placeholder="<!-- Meta Pixel code or pixel ID -->" spellCheck={false} />
          </MarketingField>
          <MarketingField helper="Paste your Meta domain verification meta tag." label="Facebook Domain Verification">
            <textarea className={`${marketingTextareaClass} min-h-28`} defaultValue={settings.facebookDomainVerification ?? ""} name="facebookDomainVerification" placeholder={'<meta name="facebook-domain-verification" content="..." />'} spellCheck={false} />
          </MarketingField>
        </MarketingCard>

        <MarketingCard icon={Globe2} subtitle="Google Analytics, Tag Manager, and verification" title="Google Tracking">
          <MarketingField helper="Paste GTM/GA code that belongs inside the header." label="Google Analytics / Google Tag Manager Header Code">
            <textarea className={marketingTextareaClass} defaultValue={settings.googleHeaderCode ?? ""} name="googleHeaderCode" placeholder="<!-- Google Analytics or GTM header code -->" spellCheck={false} />
          </MarketingField>
          <MarketingField helper="Paste GTM noscript/body tag code." label="Google Body Tag Code">
            <textarea className={marketingTextareaClass} defaultValue={settings.googleBodyCode ?? ""} name="googleBodyCode" placeholder="<!-- Google Tag Manager noscript code -->" spellCheck={false} />
          </MarketingField>
          <MarketingField helper="Paste your Google verification meta tag." label="Google Domain Verification">
            <textarea className={`${marketingTextareaClass} min-h-28`} defaultValue={settings.googleDomainVerification ?? ""} name="googleDomainVerification" placeholder={'<meta name="google-site-verification" content="..." />'} spellCheck={false} />
          </MarketingField>
        </MarketingCard>
      </div>

      <aside className="flex items-start gap-3 rounded-xl border border-[#e5e0f7] bg-[#f7f4ff] px-4 py-3 text-xs leading-5 text-[#655d78]">
        <BarChart3 className="mt-0.5 h-4 w-4 shrink-0 text-[#7548f5]" />
        Tracking code is saved with your store settings. It is not executed or injected into your storefront preview.
      </aside>

      <div className="flex flex-wrap justify-end gap-3">
        <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-4 text-sm font-semibold text-[#555762] hover:bg-[#f8f7fc]" onClick={() => formRef.current?.reset()} type="button"><RotateCcw className="h-4 w-4" />Reset</button>
        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6436e8] disabled:opacity-60" disabled={isPending} type="submit"><Save className="h-4 w-4" />{isPending ? "Saving..." : "Save Marketing Settings"}</button>
      </div>
    </form>
  );
}

function MarketingCard({ children, icon: Icon, subtitle, title }: { children: ReactNode; icon: ComponentType<{ className?: string }>; subtitle: string; title: string }) {
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

function MarketingField({ children, helper, label }: { children: ReactNode; helper: string; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#33343e]">
      {label}
      {children}
      <span className="text-[11px] font-normal leading-5 text-[#858691]">{helper}</span>
    </label>
  );
}
