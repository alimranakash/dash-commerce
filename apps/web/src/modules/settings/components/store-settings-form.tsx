"use client";

import { Button } from "@dash/ui";
import { useActionState, useState, type ReactNode } from "react";
import { MediaUrlPicker } from "../../media/components/media-url-picker";
import type { MediaPickerAsset } from "../../media/media.types";
import type { SettingsActionState } from "../settings.actions";

export type StoreSettingsFormValue = {
  logoUrl?: string | null;
  faviconUrl?: string | null;
  tagline?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  supportPhone?: string | null;
  businessAddress?: string | null;
  facebookUrl?: string | null;
  instagramUrl?: string | null;
  whatsappNumber?: string | null;
};

type StoreSettingsFormProps = {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  mediaAssets: MediaPickerAsset[];
  settings: StoreSettingsFormValue;
  store: {
    currency: string;
    name: string;
    slug: string;
    timezone: string;
  };
};

const initialState: SettingsActionState = {
  status: "idle"
};

export function StoreSettingsForm({
  action,
  mediaAssets,
  settings,
  store
}: StoreSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [faviconUrl, setFaviconUrl] = useState(settings.faviconUrl ?? "");

  return (
    <form action={formAction} className="resource-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-section-heading">
        <h2>Store information</h2>
        <p>Core store identity and regional configuration.</p>
      </div>
      <div className="form-grid">
        <label>Store Name<input readOnly value={store.name} /></label>
        <label>Store URL<input readOnly value={`${store.slug}.dash.com`} /></label>
        <label>Store Currency<input readOnly value={store.currency} /></label>
        <label>Store Language<input readOnly value="English" /></label>
        <label>Timezone<input readOnly value={store.timezone} /></label>
      </div>
      <div className="form-section-heading">
        <h2>Branding</h2>
        <p>Logo, favicon, and tagline used across the storefront experience.</p>
      </div>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="logoUrl">
          <label>
            Store Logo
            <input accept="image/jpeg,image/png,image/webp,image/svg+xml" name="logoFile" type="file" />
            <input
              name="logoUrl"
              onChange={(event) => setLogoUrl(event.target.value)}
              placeholder="Or paste logo image URL"
              type="text"
              value={logoUrl}
            />
          </label>
          {logoUrl ? <img alt="Store logo preview" className="settings-image-preview" src={logoUrl} /> : null}
          <MediaUrlPicker assets={mediaAssets} label="Use uploaded logo" onSelect={setLogoUrl} />
        </FieldError>
        <FieldError errors={state.fieldErrors} name="faviconUrl">
          <label>
            Favicon
            <input accept="image/jpeg,image/png,image/webp,image/svg+xml" name="faviconFile" type="file" />
            <input
              name="faviconUrl"
              onChange={(event) => setFaviconUrl(event.target.value)}
              placeholder="Or paste favicon image URL"
              type="text"
              value={faviconUrl}
            />
          </label>
          {faviconUrl ? <img alt="Favicon preview" className="settings-favicon-preview" src={faviconUrl} /> : null}
          <MediaUrlPicker assets={mediaAssets} label="Use uploaded favicon" onSelect={setFaviconUrl} />
        </FieldError>
      </div>
      <FieldError errors={state.fieldErrors} name="tagline">
        <label>
          Store Tagline
          <input
            defaultValue={settings.tagline ?? ""}
            maxLength={180}
            name="tagline"
            placeholder="Quality products, fast delivery, and friendly support."
            type="text"
          />
        </label>
      </FieldError>
      <div className="form-section-heading">
        <h2>Basic store configuration</h2>
        <p>Contact details and business address shown to customers.</p>
      </div>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="contactEmail">
          <label>
            Store Email
            <input defaultValue={settings.contactEmail ?? ""} name="contactEmail" type="email" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="contactPhone">
          <label>
            Store Phone
            <input defaultValue={settings.contactPhone ?? ""} name="contactPhone" type="tel" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="supportPhone">
          <label>
            Support Phone
            <input defaultValue={settings.supportPhone ?? ""} name="supportPhone" type="tel" />
          </label>
        </FieldError>
      </div>
      <FieldError errors={state.fieldErrors} name="businessAddress">
        <label>
          Store Address
          <textarea
            defaultValue={settings.businessAddress ?? ""}
            name="businessAddress"
            rows={4}
          />
        </label>
      </FieldError>
      <div className="form-actions">
        <Button className="primary action-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

function FieldError({
  children,
  errors,
  name
}: {
  children: ReactNode;
  errors?: Record<string, string> | undefined;
  name: string;
}) {
  return (
    <div className="field-shell">
      {children}
      {errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}
    </div>
  );
}
