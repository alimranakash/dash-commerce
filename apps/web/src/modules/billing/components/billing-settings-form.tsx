"use client";

import { Button } from "@dash/ui";
import { Save } from "lucide-react";
import { useActionState, type ReactNode } from "react";
import type { BillingActionState } from "../billing.actions";

type BillingSettingsFormProps = {
  action: (state: BillingActionState, formData: FormData) => Promise<BillingActionState>;
  settings: {
    bankAccountDetails: string | null;
    bkashAccountType: string | null;
    bkashNumber: string | null;
    nagadAccountType: string | null;
    nagadNumber: string | null;
    paymentInstructions: string | null;
    rocketAccountType: string | null;
    rocketNumber: string | null;
  };
};

const initialState: BillingActionState = { status: "idle" };

export function BillingSettingsForm({ action, settings }: BillingSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="grid gap-5">
      {state.status === "error" && state.message ? (
        <p className="m-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{state.message}</p>
      ) : null}
      <div className="grid gap-5 xl:grid-cols-2">
        <SettingsCard title="Mobile Financial Services">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="bKash Number" name="bkashNumber" placeholder="01XXXXXXXXX" value={settings.bkashNumber} />
            <Field label="bKash Account Type" name="bkashAccountType" placeholder="Merchant / Personal" value={settings.bkashAccountType} />
            <Field label="Nagad Number" name="nagadNumber" placeholder="01XXXXXXXXX" value={settings.nagadNumber} />
            <Field label="Nagad Account Type" name="nagadAccountType" placeholder="Merchant / Personal" value={settings.nagadAccountType} />
            <Field label="Rocket Number" name="rocketNumber" placeholder="01XXXXXXXXX" value={settings.rocketNumber} />
            <Field label="Rocket Account Type" name="rocketAccountType" placeholder="Merchant / Personal" value={settings.rocketAccountType} />
          </div>
        </SettingsCard>

        <SettingsCard title="Bank Transfer">
          <label className="grid gap-2 text-sm font-medium text-[#30313d]">
            Bank Account Details
            <textarea className={`${inputClass} min-h-40 py-3`} defaultValue={settings.bankAccountDetails ?? ""} name="bankAccountDetails" placeholder="Bank name, account name, account number, branch, routing number" />
          </label>
        </SettingsCard>
      </div>

      <SettingsCard title="Payment Instructions">
        <label className="grid gap-2 text-sm font-medium text-[#30313d]">
          Instructions shown to sellers
          <textarea className={`${inputClass} min-h-32 py-3`} defaultValue={settings.paymentInstructions ?? ""} name="paymentInstructions" placeholder="Send the exact plan amount, then submit your transaction ID for manual verification." />
        </label>
      </SettingsCard>

      <div className="flex justify-end">
        <Button className="h-11 cursor-pointer rounded-lg bg-[#7c3aed] px-5 font-semibold text-white hover:bg-[#6d28d9] disabled:opacity-60" disabled={isPending} type="submit">
          <Save className="mr-2 h-4 w-4" />
          {isPending ? "Saving..." : "Save Billing Settings"}
        </Button>
      </div>
    </form>
  );
}

const inputClass = "h-11 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 text-sm font-normal text-[#2d2e38] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10";

function SettingsCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <h2 className="m-0 mb-5 text-base font-semibold text-[#20212c]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, name, placeholder, value }: { label: string; name: string; placeholder: string; value: string | null }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#30313d]">
      {label}
      <input className={inputClass} defaultValue={value ?? ""} name={name} placeholder={placeholder} />
    </label>
  );
}
