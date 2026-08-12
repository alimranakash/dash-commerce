"use client";

import { CheckCircle2, Loader2, PlugZap, Save, ShieldCheck, Star, XCircle } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import type { CourierAccountView } from "../courier-accounts.service";
import {
  saveCourierAccountFormAction,
  setDefaultCourierAccountAction,
  testCourierConnectionAction,
  type CourierActionState
} from "../courier.actions";

/**
 * Registry-driven provider cards.
 *
 * Everything rendered here comes from the provider descriptor, so a new carrier
 * appears with its own credential fields and no change to this file. Carriers
 * that are not implemented are shown but refuse credentials, rather than
 * collecting keys nothing reads.
 *
 * Secrets are write-only: the server sends a `••••7f2a` hint and never the
 * value, and an empty field on save keeps whatever is stored.
 */

const initialState: CourierActionState = { status: "idle" };

export function CourierSettingsCards({
  accounts,
  encryptionReady
}: {
  accounts: CourierAccountView[];
  encryptionReady: boolean;
}) {
  return (
    <div className="grid gap-5">
      {encryptionReady ? null : (
        <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          <strong>COURIER_CREDENTIALS_KEY is not set.</strong> Courier credentials are encrypted at
          rest with it, so saving is disabled until it is added to the root <code>.env</code>.
        </p>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {accounts.map((account) => (
          <ProviderCard account={account} encryptionReady={encryptionReady} key={account.key} />
        ))}
      </div>
    </div>
  );
}

function ProviderCard({
  account,
  encryptionReady
}: {
  account: CourierAccountView;
  encryptionReady: boolean;
}) {
  const [state, formAction, isSaving] = useActionState(saveCourierAccountFormAction, initialState);
  const [sideState, setSideState] = useState<CourierActionState>(initialState);
  const [isBusy, startTransition] = useTransition();
  const disabled = !account.implemented || !encryptionReady;
  const feedback = state.status !== "idle" ? state : sideState;

  function runTest() {
    startTransition(async () => {
      setSideState(await testCourierConnectionAction(account.key));
    });
  }

  function makeDefault() {
    startTransition(async () => {
      setSideState(await setDefaultCourierAccountAction(account.key));
    });
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="flex items-start justify-between gap-4 border-b border-[#ececf5] px-5 py-5">
        <span className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f0ebff] text-[#7548f5]">
            <PlugZap className="h-5 w-5" />
          </span>
          <span>
            <strong className="flex items-center gap-2 text-sm">
              {account.label}
              {account.isDefault ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#f0ebff] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#6d3cf5]">
                  <Star className="h-3 w-3" />Default
                </span>
              ) : null}
            </strong>
            <span className="mt-0.5 block text-[11px] text-[#858691]">{account.tagline}</span>
          </span>
        </span>
        {account.implemented ? null : (
          <span className="rounded-full bg-[#f4f3f9] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[#858691]">
            Coming soon
          </span>
        )}
      </header>

      {account.implemented ? (
        <form action={formAction} className="grid gap-4 p-5">
          <input name="provider" type="hidden" value={account.key} />

          {account.fields.map((field) => {
            const hint = account.secretHints[field.name];

            return (
              <label className="grid gap-2 text-sm font-medium text-[#33343e]" key={field.name}>
                <span className="flex items-center justify-between gap-2">
                  {field.label}
                  {field.secret && hint ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-normal text-[#858691]">
                      <ShieldCheck className="h-3 w-3" />stored {hint}
                    </span>
                  ) : null}
                </span>
                <input
                  autoComplete={field.secret ? "new-password" : "off"}
                  className="h-12 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:bg-[#f7f6fb]"
                  defaultValue={field.secret ? "" : account.publicValues[field.name] ?? field.defaultValue ?? ""}
                  disabled={disabled}
                  name={field.name}
                  placeholder={field.secret && hint ? "Leave blank to keep the stored value" : field.placeholder ?? ""}
                  type={field.secret ? "password" : field.type ?? "text"}
                />
                {field.helpText ? (
                  <span className="text-[11px] font-normal text-[#858691]">{field.helpText}</span>
                ) : null}
              </label>
            );
          })}

          <div className="grid gap-2 border-t border-[#f0eff7] pt-4">
            <Checkbox
              defaultChecked={account.isEnabled}
              disabled={disabled}
              label="Enabled for bookings"
              name="isEnabled"
            />
            <Checkbox
              defaultChecked={account.isDefault}
              disabled={disabled}
              label="Use as the store's default courier"
              name="isDefault"
            />
          </div>

          {account.lastTestedAt ? (
            <p className="m-0 flex items-center gap-1.5 text-[11px] text-[#858691]">
              {account.lastTestStatus === "OK" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-rose-500" />
              )}
              {account.lastTestMessage ?? account.lastTestStatus} · {formatDate(account.lastTestedAt)}
            </p>
          ) : null}

          {feedback.status !== "idle" && feedback.message ? (
            <p className={`m-0 rounded-lg px-3 py-2 text-[11px] leading-5 ${toneClass(feedback.status)}`}>
              {feedback.message}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-2">
            {account.hasCredentials && !account.isDefault ? (
              <button
                className="h-9 rounded-lg border border-[#dcd9e8] bg-white px-3.5 text-xs font-semibold text-[#5f616d] hover:border-[#bdb6da] hover:bg-[#faf9ff] disabled:opacity-60"
                disabled={isBusy || disabled}
                onClick={makeDefault}
                type="button"
              >
                Make default
              </button>
            ) : null}
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#dcd9e8] bg-white px-3.5 text-xs font-semibold text-[#5f616d] hover:border-[#bdb6da] hover:bg-[#faf9ff] disabled:opacity-60"
              disabled={isBusy || disabled || !account.hasCredentials}
              onClick={runTest}
              type="button"
            >
              {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Test connection
            </button>
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#7548f5] px-4 text-xs font-semibold text-white hover:bg-[#6436e8] disabled:opacity-60"
              disabled={isSaving || disabled}
              type="submit"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      ) : (
        <p className="m-0 px-5 py-6 text-xs leading-6 text-[#777985]">
          {account.label} is not connected yet, so credentials are not collected here. Steadfast is
          the supported carrier today — everything on this page works the same way once
          {` ${account.label}`} lands.
        </p>
      )}
    </section>
  );
}

function Checkbox({
  defaultChecked,
  disabled,
  label,
  name
}: {
  defaultChecked: boolean;
  disabled: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-xs font-medium text-[#5f616d]">
      <input
        className="h-4 w-4 rounded border-[#dedcea] accent-[#7548f5]"
        defaultChecked={defaultChecked}
        disabled={disabled}
        name={name}
        type="checkbox"
      />
      {label}
    </label>
  );
}

function toneClass(status: CourierActionState["status"]) {
  if (status === "success") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "warning") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
