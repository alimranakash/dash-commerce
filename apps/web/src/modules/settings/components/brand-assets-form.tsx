"use client";

import { Button } from "@dash/ui";
import { useActionState, useState, type ReactNode } from "react";
import { MediaUrlPicker } from "../../media/components/media-url-picker";
import type { MediaPickerAsset } from "../../media/media.types";
import type { SettingsActionState } from "../settings.actions";
import type { StoreSettingsFormValue } from "./store-settings-form";

const initialState: SettingsActionState = { status: "idle" };

export function BrandAssetsForm({ action, mediaAssets, settings }: {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  mediaAssets: MediaPickerAsset[];
  settings: StoreSettingsFormValue;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl ?? "");
  const [faviconUrl, setFaviconUrl] = useState(settings.faviconUrl ?? "");

  return (
    <form action={formAction} className="resource-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-section-heading"><h2>Store branding</h2><p>Logo and favicon used across the storefront and browser.</p></div>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="logoUrl"><label>Store Logo URL<input name="logoUrl" onChange={(event) => setLogoUrl(event.target.value)} type="url" value={logoUrl} /></label><MediaUrlPicker assets={mediaAssets} onSelect={setLogoUrl} /></FieldError>
        <FieldError errors={state.fieldErrors} name="faviconUrl"><label>Favicon URL<input name="faviconUrl" onChange={(event) => setFaviconUrl(event.target.value)} type="url" value={faviconUrl} /></label><MediaUrlPicker assets={mediaAssets} onSelect={setFaviconUrl} /></FieldError>
      </div>
      <div className="form-actions"><Button className="primary action-button" disabled={isPending} type="submit">{isPending ? "Saving..." : "Save branding"}</Button></div>
    </form>
  );
}

function FieldError({ children, errors, name }: { children: ReactNode; errors?: Record<string, string> | undefined; name: string }) {
  return <div className="field-shell">{children}{errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}</div>;
}
