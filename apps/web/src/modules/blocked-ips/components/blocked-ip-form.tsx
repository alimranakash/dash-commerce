"use client";

import { useActionState, useEffect, useRef } from "react";
import { blockIpFormAction } from "../blocked-ip.actions";
import type { BlockedIpActionState } from "../blocked-ip.actions";

const durations: Array<{ label: string; value: string }> = [
  { label: "Until I unblock it", value: "permanent" },
  { label: "24 hours", value: "1d" },
  { label: "7 days", value: "7d" },
  { label: "30 days", value: "30d" }
];

export function BlockedIpForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState(blockIpFormAction, {
    status: "idle"
  } as BlockedIpActionState);

  // Clearing on success is what makes the form usable for the case it exists
  // for: a seller working through a list of addresses, blocking several in a row.
  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form action={formAction} className="grid gap-4" ref={formRef}>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
        <Field error={state.fieldErrors?.ipAddress} htmlFor="ipAddress" label="IP address">
          <input
            className="h-11 w-full rounded-lg border border-[#e4e3ee] px-3 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
            id="ipAddress"
            name="ipAddress"
            placeholder="103.94.135.20"
            required
          />
        </Field>
        <Field error={state.fieldErrors?.duration} htmlFor="duration" label="Block for">
          <select
            className="h-11 w-full rounded-lg border border-[#e4e3ee] bg-white px-3 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
            defaultValue="permanent"
            id="duration"
            name="duration"
          >
            {durations.map((duration) => (
              <option key={duration.value} value={duration.value}>
                {duration.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field error={state.fieldErrors?.reason} htmlFor="reason" label="Reason (optional)">
        <input
          className="h-11 w-full rounded-lg border border-[#e4e3ee] px-3 text-sm outline-none focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
          id="reason"
          name="reason"
          placeholder="Repeat fake cash-on-delivery orders"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <button
          className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Blocking..." : "Block address"}
        </button>
        {state.message ? (
          <p
            aria-live="polite"
            className={`m-0 text-sm ${state.status === "error" ? "text-[#b3273f]" : "text-emerald-700"}`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  children,
  error,
  htmlFor,
  label
}: {
  children: React.ReactNode;
  error: string | undefined;
  htmlFor: string;
  label: string;
}) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[11px] font-semibold uppercase text-[#7b7c88]" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? <p className="m-0 text-xs text-[#b3273f]">{error}</p> : null}
    </div>
  );
}
