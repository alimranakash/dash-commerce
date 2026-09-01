"use client";

import { Button } from "@dash/ui";
import { CheckCircle2, ExternalLink, KeyRound, ShieldCheck, TriangleAlert } from "lucide-react";
import { useActionState, useState } from "react";
import { StatusBadge } from "../../../components/dashboard/status-badge";
import type { AiSettingsActionState } from "../ai-provider.actions";
import {
  AI_PROVIDER_META,
  AI_PROVIDERS,
  type AiProvider,
  type AiSettingsView
} from "../ai-provider.schema";

const initialState: AiSettingsActionState = { status: "idle" };

/**
 * StoreIM AI → Settings → AI provider.
 *
 * Laid out as one card per provider rather than a four-cell grid of loose
 * fields. A seller's question here is "which engine is answering, and is its key
 * in?" — and the old layout answered it across two columns and four labels that
 * wrapped differently at every width. Each provider now owns a panel with its
 * own key, model and status, and the one selected in the dropdown is ringed, so
 * the answer is a glance.
 *
 * The key fields are still the point of the layout: each renders as
 * "Configured — enter to replace" when something is stored, because the seller
 * *cannot* read it back. Leaving it blank keeps the stored key, so saving a
 * changed model does not cost them a credential; removing one is the explicit
 * checkbox beside it. That asymmetry is why the two controls exist rather than
 * one.
 *
 * Nothing in `settings` is a secret — the server collapsed the ciphers to
 * booleans and last-four hints before this component was rendered.
 */
export function AiProviderSettings({
  action,
  canManage,
  settings
}: {
  action: (state: AiSettingsActionState, formData: FormData) => Promise<AiSettingsActionState>;
  canManage: boolean;
  settings: AiSettingsView;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const view = state.view ?? settings;
  const [provider, setProvider] = useState<AiProvider>(view.defaultProvider);

  return (
    <form action={formAction} className="aiset-section">
      <div className="aiset-head">
        <div className="aiset-head-text">
          <p className="aiset-eyebrow">Engine</p>
          <h2>AI provider</h2>
          <p className="aiset-section-copy">
            Which engine writes for this store. Bring your own Gemini or OpenAI key and it is billed
            to your account — no plan stands in the way of a key you pay for.
          </p>
        </div>
        <StatusBadge tone={provider === "storeos" ? "gray" : "green"}>
          {provider === "storeos" ? "Built-in engine" : `Using ${AI_PROVIDER_META[provider].label}`}
        </StatusBadge>
      </div>

      <p className="aiset-note">
        <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span>
          <strong>Keys never reach the browser.</strong> They are encrypted at rest and used
          server-side only. If a provider cannot answer, StoreIM AI and then a draft built from your
          own product details take over.
        </span>
      </p>

      {view.encryptionConfigured ? null : (
        <p className="aiset-warning">
          <TriangleAlert aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>
            This server has no encryption key configured, so API keys cannot be saved yet. Set
            COURIER_CREDENTIALS_KEY (or SECRETS_ENCRYPTION_KEY) in the root .env.
          </span>
        </p>
      )}

      <label className="aiset-field aiset-default">
        <span>Default provider</span>
        <select
          disabled={!canManage}
          name="defaultProvider"
          onChange={(event) => setProvider(event.target.value as AiProvider)}
          value={provider}
        >
          {AI_PROVIDERS.map((option) => (
            <option key={option} value={option}>
              {AI_PROVIDER_META[option].label}
            </option>
          ))}
        </select>
        <small>{AI_PROVIDER_META[provider].description}</small>
        <FieldError errors={state.fieldErrors} name="defaultProvider" />
      </label>

      <div className="aiset-providers">
        <ProviderPanel
          canManage={canManage}
          configured={view.geminiConfigured}
          errors={state.fieldErrors}
          hint={view.geminiHint}
          isActive={provider === "gemini"}
          keyName="geminiApiKey"
          model={view.geminiModel}
          modelName="geminiModel"
          providerKey="gemini"
        />
        <ProviderPanel
          canManage={canManage}
          configured={view.openaiConfigured}
          errors={state.fieldErrors}
          hint={view.openaiHint}
          isActive={provider === "openai"}
          keyName="openaiApiKey"
          model={view.openaiModel}
          modelName="openaiModel"
          providerKey="openai"
        />
      </div>

      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      {state.status === "success" ? (
        <p className="aiset-success">
          <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </p>
      ) : null}

      <div className="aiset-footer">
        <p className="aiset-footer-note">
          {canManage
            ? "Leave a key field blank to keep the key already stored."
            : "Only the store owner or an admin can change the AI provider."}
        </p>
        {canManage ? (
          <Button className="primary action-button" disabled={isPending} type="submit">
            {isPending ? "Saving..." : "Save AI settings"}
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * One provider: its key, its model, and whether the key is in.
 *
 * The status badge reads from `configured` rather than from the dropdown, so a
 * store can keep a spare OpenAI key stored while running on Gemini and still see
 * at a glance that both are ready.
 */
function ProviderPanel({
  canManage,
  configured,
  errors,
  hint,
  isActive,
  keyName,
  model,
  modelName,
  providerKey
}: {
  canManage: boolean;
  configured: boolean;
  errors?: Record<string, string> | undefined;
  hint: string | null;
  isActive: boolean;
  keyName: string;
  model: string;
  modelName: string;
  providerKey: "gemini" | "openai";
}) {
  const meta = AI_PROVIDER_META[providerKey];

  return (
    <section className={`aiset-provider${isActive ? " is-active" : ""}`}>
      <header className="aiset-provider-head">
        <strong>{meta.label}</strong>
        <StatusBadge tone={configured ? "green" : "gray"}>
          {configured ? "Key stored" : "No key"}
        </StatusBadge>
      </header>

      <label className="aiset-field">
        <span>API key</span>
        <input
          autoComplete="off"
          disabled={!canManage}
          name={keyName}
          placeholder={configured ? "Configured — enter to replace" : `Enter ${meta.label} API key`}
          type="password"
        />
      </label>

      <p className="aiset-keystate">
        {configured ? (
          <>
            <KeyRound aria-hidden="true" className="h-3 w-3 shrink-0" />
            <span>Stored</span>
            {hint ? <code>{hint}</code> : null}
          </>
        ) : (
          <span>Not configured</span>
        )}
        {meta.keyUrl ? (
          <a
            className="aiset-link"
            href={meta.keyUrl}
            rel="noreferrer"
            target="_blank"
            title={`Opens ${meta.keyUrl} in a new tab`}
          >
            {configured ? "Manage keys" : meta.keyCta}
            <ExternalLink aria-hidden="true" className="h-3 w-3" />
          </a>
        ) : null}
      </p>

      <FieldError errors={errors} name={keyName} />

      <label className="aiset-field">
        <span>Model</span>
        <input
          defaultValue={model}
          disabled={!canManage}
          name={modelName}
          placeholder={meta.modelPlaceholder}
          type="text"
        />
      </label>

      <FieldError errors={errors} name={modelName} />

      {configured && canManage ? (
        <label className="aiset-check">
          <input name={`${keyName}Cleared`} type="checkbox" />
          Remove the stored {meta.label} key
        </label>
      ) : null}
    </section>
  );
}

function FieldError({
  errors,
  name
}: {
  errors?: Record<string, string> | undefined;
  name: string;
}) {
  return errors?.[name] ? <span className="field-error">{errors[name]}</span> : null;
}
