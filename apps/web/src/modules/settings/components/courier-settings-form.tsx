"use client";

import { Box, Eye, EyeOff, PackageCheck, Route, Save, Send, Truck } from "lucide-react";
import { useState, type ComponentType, type FormEvent } from "react";

type CourierKey = "pathao" | "steadfast" | "redx" | "paperfly" | "carrybee";
type CourierField = {
  label: string;
  name: string;
  placeholder: string;
  secret?: boolean;
  type?: "email" | "text" | "url";
};

type CourierProvider = {
  fields: CourierField[];
  icon: ComponentType<{ className?: string }>;
  key: CourierKey;
  name: string;
};

const providers: CourierProvider[] = [
  {
    fields: [
      { label: "Pathao API Base URL", name: "baseUrl", placeholder: "https://api-hermes.pathao.com", type: "url" },
      { label: "Store ID", name: "storeId", placeholder: "Enter Pathao store ID" },
      { label: "Client ID", name: "clientId", placeholder: "Enter client ID" },
      { label: "Client Secret", name: "clientSecret", placeholder: "Enter client secret", secret: true },
      { label: "Client Email", name: "clientEmail", placeholder: "courier@example.com", type: "email" },
      { label: "Client Password", name: "clientPassword", placeholder: "Enter client password", secret: true }
    ],
    icon: Truck,
    key: "pathao",
    name: "Pathao"
  },
  {
    fields: [
      { label: "API Base URL", name: "baseUrl", placeholder: "https://portal.packzy.com/api/v1", type: "url" },
      { label: "API Key", name: "apiKey", placeholder: "Enter API key", secret: true },
      { label: "Secret Key", name: "secretKey", placeholder: "Enter secret key", secret: true }
    ],
    icon: PackageCheck,
    key: "steadfast",
    name: "SteadFast"
  },
  {
    fields: [
      { label: "API Base URL", name: "baseUrl", placeholder: "https://openapi.redx.com.bd/v1.0.0-beta", type: "url" },
      { label: "Store ID", name: "storeId", placeholder: "Enter RedX store ID" },
      { label: "API Token", name: "apiToken", placeholder: "Enter API token", secret: true }
    ],
    icon: Route,
    key: "redx",
    name: "RedX"
  },
  {
    fields: [
      { label: "API Base URL", name: "baseUrl", placeholder: "https://api.paperfly.com.bd", type: "url" },
      { label: "Username", name: "username", placeholder: "Enter username" },
      { label: "Password", name: "password", placeholder: "Enter password", secret: true },
      { label: "API Key", name: "apiKey", placeholder: "Enter API key", secret: true }
    ],
    icon: Send,
    key: "paperfly",
    name: "Paperfly"
  },
  {
    fields: [
      { label: "Carry Bee Base URL", name: "baseUrl", placeholder: "https://api.carrybee.com", type: "url" },
      { label: "Carrybee Client ID", name: "clientId", placeholder: "Enter client ID" },
      { label: "Carrybee Client Secret", name: "clientSecret", placeholder: "Enter client secret", secret: true },
      { label: "Carrybee Client Context", name: "clientContext", placeholder: "Enter client context", secret: true }
    ],
    icon: Box,
    key: "carrybee",
    name: "Carry Bee"
  }
];

export function CourierSettingsForm() {
  const [enabled, setEnabled] = useState<Record<CourierKey, boolean>>({ carrybee: false, paperfly: false, pathao: false, redx: false, steadfast: false });
  const [visibleSecrets, setVisibleSecrets] = useState<Record<string, boolean>>({});
  const [message, setMessage] = useState("");

  function submitSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Courier settings are ready to save when secure credential storage is connected.");
  }

  return (
    <form className="grid gap-5" onSubmit={submitSettings}>
      {message ? <p className="m-0 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</p> : null}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        {providers.map((provider) => {
          const Icon = provider.icon;
          return (
            <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]" key={provider.key}>
              <header className="flex items-center justify-between gap-4 border-b border-[#ececf5] px-5 py-5">
                <span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-lg bg-[#f0ebff] text-[#7548f5]"><Icon className="h-5 w-5" /></span><span><strong className="block text-sm">{provider.name}</strong><span className="mt-0.5 block text-[11px] text-[#858691]">API credentials and connection</span></span></span>
                <Toggle checked={enabled[provider.key]} label={`Enable ${provider.name}`} onChange={(checked) => setEnabled((current) => ({ ...current, [provider.key]: checked }))} />
              </header>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                {provider.fields.map((field) => {
                  const inputName = `${provider.key}.${field.name}`;
                  const secretVisible = Boolean(visibleSecrets[inputName]);
                  return (
                    <label className="grid gap-2 text-sm font-medium text-[#33343e]" key={inputName}>
                      {field.label}
                      <div className="relative">
                        <input
                          autoComplete={field.secret ? "new-password" : "off"}
                          className={`h-12 w-full rounded-lg border border-[#dedcea] bg-white px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 ${field.secret ? "pr-12" : ""}`}
                          name={inputName}
                          placeholder={field.placeholder}
                          type={field.secret ? (secretVisible ? "text" : "password") : field.type ?? "text"}
                        />
                        {field.secret ? (
                          <button
                            aria-label={`${secretVisible ? "Hide" : "Show"} ${field.label}`}
                            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-[#777985] hover:text-[#7548f5]"
                            onClick={() => setVisibleSecrets((current) => ({ ...current, [inputName]: !secretVisible }))}
                            type="button"
                          >
                            {secretVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
                <div className="flex justify-end sm:col-span-2">
                  <button className="h-9 rounded-lg border border-[#dcd9e8] bg-white px-3.5 text-xs font-semibold text-[#5f616d] hover:border-[#bdb6da] hover:bg-[#faf9ff]" onClick={() => setMessage(`${provider.name} connection testing will be available with the courier integration.`)} type="button">Test Connection</button>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <div className="flex justify-end">
        <button className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white shadow-sm hover:bg-[#6436e8]" type="submit"><Save className="h-4 w-4" />Save Courier Settings</button>
      </div>
    </form>
  );
}

function Toggle({ checked, label, onChange }: { checked: boolean; label: string; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#686a76]">
      <span className="hidden sm:inline">{label}</span>
      <input checked={checked} className="peer sr-only" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      <span className="relative h-5 w-9 rounded-full bg-[#d9d7e3] transition peer-checked:bg-[#7548f5] after:absolute after:left-0.5 after:top-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:after:translate-x-4" />
    </label>
  );
}
