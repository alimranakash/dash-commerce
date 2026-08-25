"use client";

import { ExternalLink, RotateCcw, Save } from "lucide-react";
import type { ReactNode } from "react";
import { marketingIdHints, type MarketingIdField } from "../marketing.schema";

/**
 * The pieces every Analytics & Tracking page is built from.
 *
 * Lifted out of the old single-page form when it was split per platform. One
 * copy, so the seven pages cannot drift into looking like seven different
 * products.
 */

export const trackingInputClass =
  "h-11 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 font-mono text-sm text-[#292a34] outline-none placeholder:font-sans placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f5fa] disabled:text-[#8b8c99]";

export const trackingTextareaClass =
  "min-h-32 w-full resize-y rounded-lg border border-[#dedcea] bg-white px-3.5 py-3 font-mono text-xs leading-5 text-[#292a34] outline-none placeholder:font-sans placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f6f5fa] disabled:text-[#8b8c99]";

export function IdField({
  disabled,
  docHref,
  error,
  field,
  helper,
  label,
  value
}: {
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
      <input
        autoComplete="off"
        className={trackingInputClass}
        defaultValue={value}
        disabled={disabled}
        name={field}
        placeholder={marketingIdHints[field].example}
        spellCheck={false}
        type="text"
      />
      {error ? (
        <span className="text-[11px] font-medium text-rose-600">
          {error} {docHref ? <DocLink href={docHref} /> : null}
        </span>
      ) : (
        <span className="text-[11px] font-normal leading-5 text-[#858691]">
          {helper} {docHref ? <DocLink href={docHref} /> : null}
        </span>
      )}
    </label>
  );
}

export function CodeField({
  disabled,
  error,
  helper,
  label,
  name,
  value
}: {
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
      <textarea
        className={trackingTextareaClass}
        defaultValue={value}
        disabled={disabled}
        name={name}
        spellCheck={false}
      />
      {error ? (
        <span className="text-[11px] font-medium text-rose-600">{error}</span>
      ) : (
        <span className="text-[11px] font-normal leading-5 text-[#858691]">{helper}</span>
      )}
    </label>
  );
}

export function DocLink({ href }: { href: string }) {
  return (
    <a
      className="dash-doc-link inline-flex items-center gap-1 whitespace-nowrap font-medium"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      Where to find this
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}

/**
 * `icon` is a rendered element, not a component.
 *
 * These cards are configured from server components, and a component is an
 * object with methods — React refuses to serialise one across that boundary.
 * An element crosses fine, and it matches how every other card in this codebase
 * takes its icon.
 */
export function TrackingCard({
  children,
  icon,
  subtitle,
  title
}: {
  children: ReactNode;
  icon: ReactNode;
  subtitle: string;
  title: string;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="flex items-center gap-3 border-b border-[#ececf5] px-5 py-5">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[#f0ebff] text-[#7548f5]">
          {icon}
        </span>
        <span>
          <h2 className="m-0 text-sm font-semibold text-[#292a34]">{title}</h2>
          <span className="mt-1 block text-[11px] text-[#858691]">{subtitle}</span>
        </span>
      </header>
      <div className="grid gap-5 p-5">{children}</div>
    </section>
  );
}

export function TrackingStatusBanner({
  message,
  status
}: {
  message: string | undefined;
  status: "error" | "idle" | "success";
}) {
  if (status === "idle" || !message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={`m-0 rounded-lg border px-4 py-3 text-sm font-medium ${status === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}
    >
      {message}
    </p>
  );
}

export function TrackingSaveBar({
  isPending,
  onReset
}: {
  isPending: boolean;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-3">
      <button
        className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-4 text-sm font-semibold text-[#555762] hover:bg-[#f8f7fc]"
        onClick={onReset}
        type="button"
      >
        <RotateCcw className="h-4 w-4" />
        Reset
      </button>
      <button
        className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6436e8] disabled:opacity-60"
        disabled={isPending}
        type="submit"
      >
        <Save className="h-4 w-4" />
        {isPending ? "Saving..." : "Save"}
      </button>
    </div>
  );
}

/** Shown to members, who may read these settings but not change them. */
export function TrackingReadOnlyNotice() {
  return (
    <p className="m-0 rounded-lg border border-[#f4e6d8] bg-[#fffaf4] px-4 py-3 text-sm text-[#8a6134]">
      You can view these settings, but only the store owner or an admin can change them.
    </p>
  );
}
