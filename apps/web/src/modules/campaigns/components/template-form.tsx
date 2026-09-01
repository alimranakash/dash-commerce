"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import { countSmsSegments } from "../campaign.schema";
import { CAMPAIGN_PLACEHOLDERS } from "../campaign-message";
import type { MarketingActionState } from "../audience.actions";

export type TemplateFormValue = {
  body?: string;
  name?: string;
};

type TemplateFormProps = {
  action: (state: MarketingActionState, formData: FormData) => Promise<MarketingActionState>;
  cancelHref: string;
  heading: string;
  template?: TemplateFormValue;
};

const initialState: MarketingActionState = { status: "idle" };

export function TemplateForm({ action, cancelHref, heading, template }: TemplateFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();

  // A plan refusal opens the shared upgrade dialog rather than reading as a
  // validation error the seller could fix by editing the fields.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);
  const [body, setBody] = useState(template?.body ?? "");
  const { limit, segments, unicode } = countSmsSegments(body);

  return (
    <form action={formAction} className="grid max-w-2xl gap-5">
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
            {isPending ? "Saving…" : "Save template"}
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

      <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
        <div className="grid gap-5 p-5">
          <Field errors={state.fieldErrors} label="Name" name="name">
            <input
              className={inputClass}
              defaultValue={template?.name ?? ""}
              name="name"
              placeholder="Eid discount announcement"
              required
              type="text"
            />
          </Field>
          <Field
            errors={state.fieldErrors}
            hint={`${body.length} characters · ${segments} SMS ${segments === 1 ? "segment" : "segments"}${unicode ? ` · non-Latin text, ${limit} per segment` : ""}`}
            label="Message"
            name="body"
          >
            <textarea
              className={`${inputClass} h-40 resize-y py-3`}
              name="body"
              onChange={(event) => setBody(event.target.value)}
              placeholder="Hi {{name}}, use code {{coupon_code}} for 20% off this week."
              required
              value={body}
            />
          </Field>
          <div className="grid gap-2">
            <span className="text-xs font-medium text-[#555762]">Placeholders you can use</span>
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
            {/* Worth saying here rather than at send time: a template using
                {{coupon_code}} is only usable on a campaign with a coupon on it. */}
            {body.includes("{{coupon_code}}") ? (
              <p className="m-0 text-xs text-[#85869a]">
                Campaigns using this template will need a coupon attached.
              </p>
            ) : null}
          </div>
        </div>
      </section>
    </form>
  );
}

const inputClass =
  "h-12 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10";

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
