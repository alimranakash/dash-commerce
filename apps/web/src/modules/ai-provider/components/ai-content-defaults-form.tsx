"use client";

import { Button } from "@dash/ui";
import { useActionState } from "react";
import {
  PRODUCT_CONTENT_LANGUAGES,
  PRODUCT_CONTENT_TONES
} from "../../product-content/product-content.schema";
import type { AiSettingsActionState } from "../ai-provider.actions";
import type { AiSettingsView } from "../ai-provider.schema";

const TONE_LABELS: Record<string, string> = {
  friendly: "Friendly",
  premium: "Premium",
  professional: "Professional"
};

const LANGUAGE_LABELS: Record<string, string> = {
  bn: "বাংলা (Bangla)",
  en: "English"
};

const initialState: AiSettingsActionState = { status: "idle" };

/**
 * StoreIM AI → AI Product Content → defaults.
 *
 * Where every generated draft starts, set once for the store rather than on
 * every product. It lives on this page and not with the provider keys because
 * it is a copy decision, not an integration one — and because the inline
 * Generate buttons on the product form have nowhere to ask for a tone, so the
 * answer has to be stored somewhere they can read it.
 */
export function AiContentDefaultsForm({
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

  return (
    <form action={formAction} className="ai-settings-form">
      <section className="product-editor-card">
        <header>
          <h2>Content defaults</h2>
          <p>
            The register every generated draft starts from. The studio can still override it for a
            single draft.
          </p>
        </header>
        <div className="product-editor-card-body">
          <div className="form-grid ai-studio-options">
            <label>
              Default tone
              <select defaultValue={view.contentTone} disabled={!canManage} name="contentTone">
                {PRODUCT_CONTENT_TONES.map((option) => (
                  <option key={option} value={option}>
                    {TONE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Default language
              <select
                defaultValue={view.contentLanguage}
                disabled={!canManage}
                name="contentLanguage"
              >
                {PRODUCT_CONTENT_LANGUAGES.map((option) => (
                  <option key={option} value={option}>
                    {LANGUAGE_LABELS[option]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="field-shell">
            <label>
              Brand voice
              <textarea
                defaultValue={view.brandVoice ?? ""}
                disabled={!canManage}
                maxLength={500}
                name="brandVoice"
                placeholder="We sell handmade jute bags to buyers in Dhaka. Plain language, no hype, and always mention free delivery over 2000 BDT."
                rows={3}
              />
              <small>
                Added to every product-content request, so drafts sound like your shop rather than a
                generic one.
              </small>
            </label>
            {state.fieldErrors?.brandVoice ? (
              <span className="field-error">{state.fieldErrors.brandVoice}</span>
            ) : null}
          </div>

          {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
          {state.status === "success" ? <p className="ai-studio-status">{state.message}</p> : null}

          {canManage ? (
            <div className="ai-settings-actions">
              <Button className="primary action-button" disabled={isPending} type="submit">
                {isPending ? "Saving..." : "Save content defaults"}
              </Button>
            </div>
          ) : (
            <p className="ai-studio-warning">
              Only the store owner or an admin can change the content defaults.
            </p>
          )}
        </div>
      </section>
    </form>
  );
}
