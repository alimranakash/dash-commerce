"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import { AudienceRuleBuilder } from "./audience-rule-builder";
import type { CampaignActionState } from "../campaign.actions";
import { countSmsSegments } from "../campaign.schema";
import { CAMPAIGN_PLACEHOLDERS } from "../campaign-message";
import type { AudienceRules } from "../audience.schema";

export type CampaignCouponOption = {
  code: string;
  id: string;
};

export type CampaignAudienceOption = {
  id: string;
  name: string;
  summary: string;
};

export type CampaignTemplateOption = {
  body: string;
  id: string;
  name: string;
};

export type CampaignFormValue = {
  audienceId?: string | null;
  body?: string;
  couponId?: string | null;
  name?: string;
  rules?: AudienceRules;
};

type CampaignFormProps = {
  action: (state: CampaignActionState, formData: FormData) => Promise<CampaignActionState>;
  audiences: CampaignAudienceOption[];
  campaign?: CampaignFormValue;
  cancelHref: string;
  coupons: CampaignCouponOption[];
  currency: string;
  heading: string;
  templates: CampaignTemplateOption[];
};

const initialState: CampaignActionState = { status: "idle" };

/** Sentinel for "not a saved audience". An empty option value is easy to mistype. */
const CUSTOM_AUDIENCE = "__custom__";

export function CampaignForm({
  action,
  audiences,
  campaign,
  cancelHref,
  coupons,
  currency,
  heading,
  templates
}: CampaignFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();
  const [audienceId, setAudienceId] = useState(campaign?.audienceId ?? CUSTOM_AUDIENCE);
  const [body, setBody] = useState(campaign?.body ?? "");
  const [templateId, setTemplateId] = useState("");

  const usingSavedAudience = audienceId !== CUSTOM_AUDIENCE;
  const { limit, segments, unicode } = countSmsSegments(body);
  const selectedAudience = audiences.find((option) => option.id === audienceId);

  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);

  /**
   * Templates are copied, not linked. Editing a template later must not rewrite
   * the message of a campaign already written from it — least of all one that
   * has already gone out.
   */
  function applyTemplate(id: string) {
    setTemplateId(id);

    const template = templates.find((option) => option.id === id);

    if (!template) {
      return;
    }

    if (body.trim() && !window.confirm("Replace the message you have written with this template?")) {
      setTemplateId("");
      return;
    }

    setBody(template.body);
  }

  return (
    <form action={formAction} className="grid gap-5">
      <input name="channel" type="hidden" value="SMS" />
      {usingSavedAudience ? <input name="audienceId" type="hidden" value={audienceId} /> : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">{heading}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex h-11 items-center rounded-lg border border-[#e5e3f1] px-4 text-sm font-medium text-[#555762] transition hover:bg-[#f7f7fb]"
            href={cancelHref}
          >
            Cancel
          </Link>
          <button
            className="h-11 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6436e8] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Saving…" : "Save draft"}
          </button>
        </div>
      </div>

      {state.status === "error" && !state.lockedFeature ? (
        <p
          aria-live="polite"
          className="m-0 rounded-lg border border-[#f5c9d0] bg-[#fdf2f4] px-4 py-3 text-sm text-[#b3273f]"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="grid gap-5">
          <CampaignCard title="Message">
            <Field errors={state.fieldErrors} label="Campaign name" name="name">
              <input
                className={inputClass}
                defaultValue={campaign?.name ?? ""}
                name="name"
                placeholder="Eid offer — returning customers"
                required
                type="text"
              />
            </Field>

            {templates.length > 0 ? (
              <Field errors={state.fieldErrors} label="Start from a template" name="templateId">
                <select
                  className={inputClass}
                  onChange={(event) => applyTemplate(event.target.value)}
                  value={templateId}
                >
                  <option value="">Write from scratch</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field
              errors={state.fieldErrors}
              hint={`${body.length} characters · ${segments} SMS ${segments === 1 ? "segment" : "segments"} each${unicode ? ` · non-Latin text, ${limit} per segment` : ""}`}
              label="Message"
              name="body"
            >
              <textarea
                className={`${inputClass} h-36 resize-y py-3`}
                name="body"
                onChange={(event) => setBody(event.target.value)}
                placeholder="Hi {{name}}, use code {{coupon_code}} for 20% off this week."
                required
                value={body}
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_PLACEHOLDERS.map((placeholder) => (
                <button
                  className="rounded-md border border-[#e5e3f1] bg-[#fafaff] px-2.5 py-1.5 font-mono text-[11px] text-[#6d3cf5] transition hover:bg-[#f3f0ff]"
                  key={placeholder}
                  onClick={() => setBody((current) => `${current}{{${placeholder}}}`)}
                  type="button"
                >
                  {`{{${placeholder}}}`}
                </button>
              ))}
            </div>

            <Field errors={state.fieldErrors} label="Attach a coupon" name="couponId">
              <select className={inputClass} defaultValue={campaign?.couponId ?? ""} name="couponId">
                <option value="">No coupon</option>
                {coupons.map((coupon) => (
                  <option key={coupon.id} value={coupon.id}>
                    {coupon.code}
                  </option>
                ))}
              </select>
            </Field>
          </CampaignCard>
        </div>

        <CampaignCard title="Audience">
          <Field errors={state.fieldErrors} label="Who should get this?" name="audienceId">
            <select
              className={inputClass}
              onChange={(event) => setAudienceId(event.target.value)}
              value={audienceId}
            >
              <option value={CUSTOM_AUDIENCE}>Custom rules for this campaign</option>
              {audiences.map((audience) => (
                <option key={audience.id} value={audience.id}>
                  {audience.name}
                </option>
              ))}
            </select>
          </Field>

          {usingSavedAudience ? (
            <div className="grid gap-2 rounded-lg border border-[#ececf5] bg-[#fafaff] px-4 py-4">
              <p className="m-0 text-sm text-[#30313d]">{selectedAudience?.summary}</p>
              {/* Worth saying: the draft tracks the saved segment, and stops
                  tracking it the moment the recipient list is built. */}
              <p className="m-0 text-xs text-[#85869a]">
                This campaign follows the saved audience until you build its recipient list.
              </p>
              <Link
                className="w-fit text-xs font-medium text-[#6d3cf5] hover:underline"
                href={`/dashboard/marketing/audiences/${audienceId}`}
              >
                Edit this audience
              </Link>
            </div>
          ) : (
            <AudienceRuleBuilder currency={currency} value={campaign?.rules ?? [{ type: "all" }]} />
          )}

          <p className="m-0 text-xs leading-5 text-[#85869a]">
            Saving creates a draft. Nothing is sent until you build the recipient list and send it
            from the campaign page.
          </p>
        </CampaignCard>
      </div>
    </form>
  );
}

const inputClass =
  "h-12 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10";

function CampaignCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="border-b border-[#ececf5] px-5 py-5">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
      </header>
      <div className="grid gap-5 p-5">{children}</div>
    </section>
  );
}

function Field({
  children,
  errors,
  hint,
  label,
  name
}: {
  children: ReactNode;
  errors: Record<string, string> | undefined;
  hint?: string;
  label: string;
  name: string;
}) {
  const error = errors?.[name];

  return (
    <label className="grid gap-2 text-sm font-medium text-[#292a34]">
      {label}
      {children}
      {error ? (
        <span className="text-xs font-normal text-[#b3273f]">{error}</span>
      ) : hint ? (
        <span className="text-xs font-normal text-[#85869a]">{hint}</span>
      ) : null}
    </label>
  );
}
