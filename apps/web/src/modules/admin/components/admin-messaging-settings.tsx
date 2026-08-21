"use client";

import { Button } from "@dash/ui";
import { KeyRound, Loader2, Mail, MessageSquare, Send, TriangleAlert } from "lucide-react";
import { useActionState, useState, useTransition, type ReactNode } from "react";
import type { MessagingSettingsState } from "../admin-messaging.actions";

type MessagingSettingsView = {
  emailEnabled: boolean;
  emailFrom: string;
  environmentFallback: { email: boolean; sms: boolean };
  secretsStorable: boolean;
  smsApiKeyHint: string | null;
  smsEnabled: boolean;
  smsProvider: string;
  smsSenderId: string;
  smtpHost: string;
  smtpPasswordHint: string | null;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
};

type Action = (state: MessagingSettingsState, formData: FormData) => Promise<MessagingSettingsState>;
/** Called outright rather than submitted — see `SecretField`. */
type ClearAction = (channel: "EMAIL" | "SMS") => Promise<MessagingSettingsState>;

const initialState: MessagingSettingsState = { status: "idle" };
const inputClass =
  "mt-2 h-11 w-full rounded-lg border border-[#e4e3ee] bg-white px-3.5 text-sm text-[#30313d] outline-none transition placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10";
const labelClass = "block text-sm font-semibold text-[#20212c]";

export function AdminMessagingSettings({
  clearAction,
  saveAction,
  settings,
  testAction
}: {
  clearAction: ClearAction;
  saveAction: Action;
  settings: MessagingSettingsView;
  testAction: Action;
}) {
  const [state, formAction, isPending] = useActionState(saveAction, initialState);
  // Only so the port placeholder can follow the toggle: a blank field reading
  // "587" beside a ticked implicit-TLS box promises a pair that cannot connect.
  const [implicitTls, setImplicitTls] = useState(settings.smtpSecure);

  return (
    <div className="grid gap-4">
      {!settings.secretsStorable ? (
        <p className="m-0 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            No encryption key is set, so keys cannot be stored here yet. Generate a 32-byte base64
            value into <b>COURIER_CREDENTIALS_KEY</b> (or <b>SECRETS_ENCRYPTION_KEY</b>) in the root
            <b> .env</b> and restart. Until then the gateways read from the environment.
          </span>
        </p>
      ) : null}

      {state.message ? (
        <p
          className={`m-0 rounded-xl border p-4 text-sm ${
            state.status === "error"
              ? "border-[#f2ccd2] bg-[#fff0f2] text-[#a43b4d]"
              : "border-[#c6ead9] bg-[#edfbf5] text-[#177356]"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="grid gap-4">
        <Card
          icon={<MessageSquare className="h-4 w-4" />}
          note={
            settings.environmentFallback.sms && !settings.smsApiKeyHint
              ? "An API key from the environment is in use. Saving one here replaces it."
              : null
          }
          title="SMS gateway"
        >
          <Toggle defaultChecked={settings.smsEnabled} label="Send SMS" name="smsEnabled" />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Provider
              <select className={inputClass} defaultValue={settings.smsProvider} name="smsProvider">
                <option value="alpha">Alpha SMS (api.sms.net.bd)</option>
              </select>
            </label>
            <label className={labelClass}>
              Sender ID
              <input
                className={inputClass}
                defaultValue={settings.smsSenderId}
                name="smsSenderId"
                placeholder="Leave blank to send unbranded"
              />
              <span className="mt-1 block text-xs font-normal text-[#74758a]">
                Only works once the gateway has approved it. A rejected ID falls back to unbranded
                automatically.
              </span>
            </label>
          </div>
          <SecretField
            action={clearAction}
            channel="SMS"
            hint={settings.smsApiKeyHint}
            label="API key"
            name="smsApiKey"
          />
        </Card>

        <Card
          icon={<Mail className="h-4 w-4" />}
          note={
            settings.environmentFallback.email && !settings.smtpHost
              ? "SMTP details from the environment are in use. Saving them here replaces them."
              : "Publish SPF and DKIM for the sending domain, or this mail lands in spam."
          }
          title="Email relay (SMTP)"
        >
          <Toggle defaultChecked={settings.emailEnabled} label="Send email" name="emailEnabled" />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className={labelClass}>
              Host
              <input className={inputClass} defaultValue={settings.smtpHost} name="smtpHost" placeholder="smtp-relay.example.com" />
            </label>
            <label className={labelClass}>
              Port
              <input className={inputClass} defaultValue={settings.smtpPort} name="smtpPort" placeholder={implicitTls ? "465" : "587"} />
            </label>
            <label className={labelClass}>
              Username
              <input className={inputClass} defaultValue={settings.smtpUser} name="smtpUser" placeholder="relay login" />
            </label>
            <label className={labelClass}>
              From address
              <input className={inputClass} defaultValue={settings.emailFrom} name="emailFrom" placeholder="Defaults to the username" />
            </label>
          </div>
          <Toggle
            defaultChecked={settings.smtpSecure}
            label="Implicit TLS (port 465). Leave off for STARTTLS on 587."
            name="smtpSecure"
            onChange={setImplicitTls}
          />
          <SecretField
            action={clearAction}
            channel="EMAIL"
            hint={settings.smtpPasswordHint}
            label="Password"
            name="smtpPassword"
          />
        </Card>

        <div>
          <Button
            className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6d28d9] disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> : null}
            {isPending ? "Saving..." : "Save messaging settings"}
          </Button>
        </div>
      </form>

      <TestSender action={testAction} />
    </div>
  );
}

/**
 * A real send to an address the admin names.
 *
 * The single most useful control on this page: a gateway can accept a key and
 * still refuse every message, and a mail relay can accept a message and have it
 * land in spam. Neither shows up in a saved form.
 */
function TestSender({ action }: { action: Action }) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-[#7c3aed]">
          <Send className="h-4 w-4" />
        </span>
        <h2 className="m-0 text-base font-semibold text-[#20212c]">Send a test</h2>
      </div>
      <p className="m-0 mt-1 text-sm text-[#74758a]">
        A new Alpha SMS account can only message its own registered number until the first balance
        recharge, so test with that number before trusting any other.
      </p>

      {state.message ? (
        <p
          className={`m-0 mt-4 rounded-lg px-3 py-2 text-sm ${
            state.status === "error" ? "bg-[#fff0f2] text-[#a43b4d]" : "bg-[#edfbf5] text-[#177356]"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)_auto] sm:items-end">
        <label className={labelClass}>
          Channel
          <select className={inputClass} defaultValue="SMS" name="channel">
            <option value="SMS">SMS</option>
            <option value="EMAIL">Email</option>
          </select>
        </label>
        <label className={labelClass}>
          Send to
          <input className={inputClass} name="recipient" placeholder="01XXXXXXXXX or you@example.com" />
        </label>
        <Button
          className="h-11 rounded-lg border border-[#e4e3ee] bg-white px-5 text-sm font-semibold text-[#565762] hover:bg-[#f7f7fa] disabled:opacity-60"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Sending..." : "Send test"}
        </Button>
      </form>
    </section>
  );
}

/**
 * A stored secret is never sent back to the browser. The hint is enough to tell
 * one key from another, and a blank field means "keep the one that is there".
 *
 * Removing a key is a plain button that calls its action, not a submit.
 *
 * This renders inside the settings form, and every form-shaped way of running a
 * second action from in there is closed off. Its own nested `<form>` is invalid
 * HTML, and the browser drops it — which had the remove button silently saving
 * the settings instead of clearing the key. `formAction` avoids that, but React
 * spends such a button's `name` attribute on its own action reference, so the
 * channel cannot ride along on it; a hidden input cannot carry it either, since
 * both secret fields sit in the same form and would collide on the name.
 *
 * Calling the action outright sidesteps all of it, at the cost of this one
 * control needing JavaScript — which the rest of this page needs anyway.
 */
function SecretField({
  action,
  channel,
  hint,
  label,
  name
}: {
  action: ClearAction;
  channel: "EMAIL" | "SMS";
  hint: string | null;
  label: string;
  name: string;
}) {
  const [state, setState] = useState(initialState);
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <label className={labelClass}>
        {label}
        <input
          autoComplete="off"
          className={inputClass}
          name={name}
          placeholder={hint ? "Leave blank to keep the stored key" : "Paste the key"}
          type="password"
        />
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-[#74758a]">
        <span className="inline-flex items-center gap-1.5">
          <KeyRound className="h-3.5 w-3.5" />
          {hint ? `Stored: ${hint}` : "Nothing stored here yet"}
        </span>
        {hint ? (
          <button
            className="font-semibold text-[#c02b52] disabled:opacity-60"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                setState(await action(channel));
              })
            }
            type="button"
          >
            {isPending ? "Removing..." : "Remove stored key"}
          </button>
        ) : null}
      </div>
      {state.message ? <p className="m-0 mt-2 text-xs text-[#74758a]">{state.message}</p> : null}
    </div>
  );
}

function Card({
  children,
  icon,
  note,
  title
}: {
  children: ReactNode;
  icon: ReactNode;
  note: string | null;
  title: string;
}) {
  return (
    <section className="grid gap-4 rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[#7c3aed]">{icon}</span>
          <h2 className="m-0 text-base font-semibold text-[#20212c]">{title}</h2>
        </div>
        {note ? <p className="m-0 mt-1 text-sm text-[#74758a]">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

function Toggle({
  defaultChecked,
  label,
  name,
  onChange
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
  onChange?: ((checked: boolean) => void) | undefined;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-[#30313d]">
      <input
        className="h-4 w-4 accent-[#7c3aed]"
        defaultChecked={defaultChecked}
        name={name}
        onChange={(event) => onChange?.(event.target.checked)}
        type="checkbox"
      />
      {label}
    </label>
  );
}
