"use client";

import {
  Globe2,
  LockKeyhole,
  MessageSquare,
  RotateCcw,
  Save
} from "lucide-react";
import { useRef, useState, type ComponentType, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";

type ProviderKey = "facebook" | "google";
type FormErrors = Record<string, string>;

const providers: Array<{ icon: ComponentType<{ className?: string }>; idLabel: string; key: ProviderKey; name: string; secretLabel: string }> = [
  { icon: MessageSquare, idLabel: "Facebook App ID", key: "facebook", name: "Facebook", secretLabel: "Facebook App Secret" },
  { icon: Globe2, idLabel: "Google Client ID", key: "google", name: "Google", secretLabel: "Google Client Secret" }
];

export function SocialSettingsForm({ redirectBaseUrl }: { redirectBaseUrl: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [enabled, setEnabled] = useState<Record<ProviderKey, boolean>>({ facebook: false, google: false });
  const [errors, setErrors] = useState<FormErrors>({});
  const [message, setMessage] = useState("");

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const nextErrors = validateSettings(formData, enabled);
    setErrors(nextErrors);
    setMessage(Object.keys(nextErrors).length ? "" : "Settings are valid and ready to save securely.");
  }

  function resetSettings() {
    formRef.current?.reset();
    setEnabled({ facebook: false, google: false });
    setErrors({});
    setMessage("");
  }

  return (
    <form className="grid gap-5" onSubmit={submitSettings} ref={formRef}>
      {message ? <p className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p> : null}
      <div className="grid items-start gap-5">
        <SettingsCard icon={LockKeyhole} title="Social Login Credentials">
          <div className="grid gap-6">
            {providers.map((provider) => {
              const Icon = provider.icon;
              return (
                <section className="grid gap-4 rounded-lg border border-[#efedf6] bg-[#fcfcff] p-4" key={provider.key}>
                  <div className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-2.5 text-sm font-semibold text-[#292a34]"><span className="grid h-8 w-8 place-items-center rounded-md bg-[#f0ebff] text-[#7548f5]"><Icon className="h-4 w-4" /></span>{provider.name}</span>
                    <Toggle checked={enabled[provider.key]} label={`Enable ${provider.name} Login`} onChange={(checked) => setEnabled((current) => ({ ...current, [provider.key]: checked }))} />
                  </div>
                  <SocialField error={errors[`${provider.key}Id`]} label={provider.idLabel}>
                    <SocialInput autoComplete="off" name={`${provider.key}Id`} placeholder={provider.idLabel} type="text" />
                  </SocialField>
                  <SocialField error={errors[`${provider.key}Secret`]} label={provider.secretLabel}>
                    <SocialInput autoComplete="new-password" name={`${provider.key}Secret`} placeholder={provider.secretLabel} type="password" />
                  </SocialField>
                  <SocialField label={`${provider.name} Redirect URL`}>
                    <SocialInput readOnly type="url" value={`${redirectBaseUrl}/api/auth/callback/${provider.key}`} />
                  </SocialField>
                </section>
              );
            })}
          </div>
        </SettingsCard>
      </div>

      <div className="flex flex-wrap justify-end gap-3">
        <button className="inline-flex h-11 items-center gap-2 rounded-lg border border-[#dcd9e8] bg-white px-4 text-sm font-semibold text-[#555762] hover:bg-[#f8f7fc]" onClick={resetSettings} type="button"><RotateCcw className="h-4 w-4" />Reset</button>
        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6436e8]" type="submit"><Save className="h-4 w-4" />Validate Login Settings</button>
      </div>
    </form>
  );
}

function SettingsCard({ children, icon: Icon, title }: { children: ReactNode; icon: ComponentType<{ className?: string }>; title: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="flex items-center gap-3 border-b border-[#ececf5] px-5 py-5"><span className="grid h-9 w-9 place-items-center rounded-lg bg-[#f0ebff] text-[#7548f5]"><Icon className="h-4.5 w-4.5" /></span><h2 className="m-0 text-base font-semibold">{title}</h2></header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function SocialField({ children, error, label }: { children: ReactNode; error?: string | undefined; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#33343e]">
      {label}
      <div className="social-settings-control">{children}</div>
      {error ? <span className="text-xs font-medium text-rose-600">{error}</span> : null}
    </label>
  );
}

const socialInputClass = "h-12 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 read-only:cursor-default read-only:bg-[#f7f7fa] read-only:text-[#777985]";

function SocialInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${socialInputClass} ${props.className ?? ""}`} />;
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#686a76]">
      <span>{label}</span>
      <input checked={checked} className="peer sr-only" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span className="relative h-5 w-9 rounded-full bg-[#d9d7e3] transition peer-checked:bg-[#7548f5] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-4" />
    </label>
  );
}

function validateSettings(formData: FormData, enabled: Record<ProviderKey, boolean>) {
  const errors: FormErrors = {};

  for (const provider of providers) {
    if (!enabled[provider.key]) continue;
    if (!value(formData, `${provider.key}Id`)) errors[`${provider.key}Id`] = `${provider.idLabel} is required when login is enabled.`;
    if (!value(formData, `${provider.key}Secret`)) errors[`${provider.key}Secret`] = `${provider.secretLabel} is required when login is enabled.`;
  }

  return errors;
}

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
