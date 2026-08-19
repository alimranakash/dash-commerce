"use client";

import { Button } from "@dash/ui";
import { BadgeCheck, Loader2, Mail, Smartphone } from "lucide-react";
import { useActionState, useState } from "react";
import { CodeInput, codeLength } from "./code-input";
import type { ContactActionState } from "./contact-change.actions";

const initialState: ContactActionState = { status: "idle" };
const inputClass =
  "mt-2 h-11 w-full rounded-lg border border-[#e4e3ee] bg-white px-3.5 text-sm text-[#30313d] outline-none transition placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10 disabled:bg-[#f7f7fb] disabled:text-[#777985]";

/**
 * The email and phone an account signs in with, and the one place either can be
 * changed. Both are verified by a code sent to the new value, which is why this
 * cannot live in the plain profile form alongside a name and an avatar.
 */
export function SignInDetailsCard({
  action,
  contacts
}: {
  action: (state: ContactActionState, formData: FormData) => Promise<ContactActionState>;
  contacts: {
    email: string | null;
    emailVerified: boolean;
    phone: string | null;
    phoneVerified: boolean;
  };
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState("");
  const challenge = state.status === "success" ? undefined : state.challenge;

  return (
    <div className="space-y-5">
      <div className="grid gap-2 sm:grid-cols-2">
        <ContactRow
          icon={<Mail className="h-4 w-4" />}
          label="Email"
          value={contacts.email}
          verified={contacts.emailVerified}
        />
        <ContactRow
          icon={<Smartphone className="h-4 w-4" />}
          label="Phone"
          value={contacts.phone}
          verified={contacts.phoneVerified}
        />
      </div>

      <form action={formAction} className="space-y-4 border-t border-[#efeff5] pt-4">
        {state.message ? (
          <p
            className={`m-0 rounded-lg px-3 py-2 text-sm ${
              state.status === "error"
                ? "bg-[#fff0f2] text-[#a43b4d]"
                : "bg-[#edfbf5] text-[#177356]"
            }`}
          >
            {state.message}
          </p>
        ) : null}

        <label className="block text-sm font-semibold text-[#20212c]">
          Add or change an email or phone
          <input
            className={inputClass}
            defaultValue={challenge?.identifier ?? ""}
            disabled={Boolean(challenge)}
            onChange={(event) => setIdentifier(event.target.value)}
            placeholder="you@company.com or 01XXXXXXXXX"
            {...(challenge ? {} : { name: "identifier" })}
          />
        </label>

        {challenge ? (
          <>
            <input name="identifier" type="hidden" value={challenge.identifier} />
            <p className="m-0 text-sm text-[#74758a]">
              Enter the {codeLength}-digit code sent by{" "}
              {challenge.channel === "SMS" ? "text message" : "email"} to{" "}
              <b className="text-[#30313d]">{challenge.identifier}</b>. Nothing changes until you do.
            </p>
            <input name="code" type="hidden" value={code} />
            <CodeInput onChange={setCode} value={code} />
            {challenge.devCode ? (
              <p className="m-0 rounded-lg bg-[#edfbf5] px-3 py-2 text-sm text-[#177356]">
                Development build: nothing is configured to send messages, so the code is{" "}
                <b>{challenge.devCode}</b>.
              </p>
            ) : null}
          </>
        ) : null}

        <Button
          className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6d28d9] disabled:opacity-60"
          disabled={
            isPending ||
            (challenge ? code.length < codeLength : identifier.trim().length === 0)
          }
          type="submit"
        >
          {isPending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
          {isPending ? "Working..." : challenge ? "Confirm the change" : "Send a code"}
        </Button>
      </form>
    </div>
  );
}

function ContactRow({
  icon,
  label,
  value,
  verified
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  verified: boolean;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#eeecf7] bg-[#fbfaff] px-3 py-2.5">
      <span className="mt-0.5 text-[#7c3aed]">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-[#74758a]">{label}</div>
        <div className="mt-0.5 break-words text-sm font-semibold text-[#30313d]">
          {value ?? "Not set"}
        </div>
      </div>
      {value && verified ? (
        <span
          className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1f9d6a]"
          title="Confirmed with a code sent to it"
        >
          <BadgeCheck className="h-3.5 w-3.5" />
          Verified
        </span>
      ) : null}
    </div>
  );
}
