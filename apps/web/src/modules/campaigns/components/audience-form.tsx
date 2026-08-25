"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { AudienceRuleBuilder } from "./audience-rule-builder";
import type { MarketingActionState } from "../audience.actions";
import type { AudienceRules } from "../audience.schema";

export type AudienceFormValue = {
  description?: string | null;
  name?: string;
  rules?: AudienceRules;
};

type AudienceFormProps = {
  action: (state: MarketingActionState, formData: FormData) => Promise<MarketingActionState>;
  audience?: AudienceFormValue;
  cancelHref: string;
  currency: string;
  heading: string;
};

const initialState: MarketingActionState = { status: "idle" };

export function AudienceForm({
  action,
  audience,
  cancelHref,
  currency,
  heading
}: AudienceFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-5">
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
            {isPending ? "Saving…" : "Save audience"}
          </button>
        </div>
      </div>

      {state.status === "error" ? (
        <p
          aria-live="polite"
          className="m-0 rounded-lg border border-[#f5c9d0] bg-[#fdf2f4] px-4 py-3 text-sm text-[#b3273f]"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card title="Details">
          <Field errors={state.fieldErrors} label="Name" name="name">
            <input
              className={inputClass}
              defaultValue={audience?.name ?? ""}
              name="name"
              placeholder="Repeat buyers"
              required
              type="text"
            />
          </Field>
          <Field errors={state.fieldErrors} label="Description" name="description">
            <textarea
              className={`${inputClass} h-24 resize-y py-3`}
              defaultValue={audience?.description ?? ""}
              name="description"
              placeholder="Who is in this segment and why"
            />
          </Field>
        </Card>

        <Card title="Rules">
          <p className="m-0 text-xs leading-5 text-[#85869a]">
            A customer has to match every rule below to be in this audience.
          </p>
          <AudienceRuleBuilder currency={currency} value={audience?.rules ?? [{ type: "all" }]} />
          {state.fieldErrors?.rules ? (
            <p className="m-0 text-xs text-[#b3273f]">{state.fieldErrors.rules}</p>
          ) : null}
        </Card>
      </div>
    </form>
  );
}

const inputClass =
  "h-12 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10";

function Card({ children, title }: { children: ReactNode; title: string }) {
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
  label,
  name
}: {
  children: ReactNode;
  errors: Record<string, string> | undefined;
  label: string;
  name: string;
}) {
  const error = errors?.[name];

  return (
    <label className="grid gap-2 text-sm font-medium text-[#292a34]">
      {label}
      {children}
      {error ? <span className="text-xs font-normal text-[#b3273f]">{error}</span> : null}
    </label>
  );
}
