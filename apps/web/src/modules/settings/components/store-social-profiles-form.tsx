"use client";

import { Button } from "@dash/ui";
import { useActionState, type ReactNode } from "react";
import type { SettingsActionState } from "../settings.actions";
import type { StoreSettingsFormValue } from "./store-settings-form";

const initialState: SettingsActionState = { status: "idle" };

export function StoreSocialProfilesForm({ action, settings }: {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  settings: StoreSettingsFormValue;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-section-heading"><h2>Social profiles</h2><p>Public profile links displayed on your storefront.</p></div>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="facebookUrl"><label>Facebook Page URL<input defaultValue={settings.facebookUrl ?? ""} name="facebookUrl" placeholder="https://facebook.com/your-store" type="url" /></label></FieldError>
        <FieldError errors={state.fieldErrors} name="instagramUrl"><label>Instagram URL<input defaultValue={settings.instagramUrl ?? ""} name="instagramUrl" placeholder="https://instagram.com/your-store" type="url" /></label></FieldError>
        <label>X / Twitter URL<input name="twitterUrl" placeholder="https://x.com/your-store" type="url" /></label>
        <label>YouTube URL<input name="youtubeUrl" placeholder="https://youtube.com/@your-store" type="url" /></label>
        <label>TikTok URL<input name="tiktokUrl" placeholder="https://tiktok.com/@your-store" type="url" /></label>
        <label>LinkedIn URL<input name="linkedinUrl" placeholder="https://linkedin.com/company/your-store" type="url" /></label>
        <FieldError errors={state.fieldErrors} name="whatsappNumber"><label>WhatsApp Number<input defaultValue={settings.whatsappNumber ?? ""} name="whatsappNumber" placeholder="+880 1XXX-XXXXXX" type="tel" /></label></FieldError>
      </div>
      <p className="m-0 text-xs text-[#858691]">Facebook, Instagram, and WhatsApp use the current store settings record. Additional profile fields are ready for future secure persistence.</p>
      <div className="form-actions"><Button className="primary action-button" disabled={isPending} type="submit">{isPending ? "Saving..." : "Save social profiles"}</Button></div>
    </form>
  );
}

function FieldError({ children, errors, name }: { children: ReactNode; errors?: Record<string, string> | undefined; name: string }) {
  return <div className="field-shell">{children}{errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}</div>;
}
