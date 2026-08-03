"use client";

import { Button } from "@dash/ui";
import { useActionState, type ReactNode } from "react";
import type { SettingsActionState } from "../settings.actions";
import type { SocialProfileLinksInput } from "../settings.schema";
import type { StoreSettingsFormValue } from "./store-settings-form";

const initialState: SettingsActionState = { status: "idle" };

export function StoreSocialProfilesForm({ action, links, settings }: {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  links: SocialProfileLinksInput;
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
        <FieldError errors={state.fieldErrors} name="twitterUrl"><label>X / Twitter URL<input defaultValue={links.twitterUrl ?? ""} name="twitterUrl" placeholder="https://x.com/your-store" type="url" /></label></FieldError>
        <FieldError errors={state.fieldErrors} name="youtubeUrl"><label>YouTube URL<input defaultValue={links.youtubeUrl ?? ""} name="youtubeUrl" placeholder="https://youtube.com/@your-store" type="url" /></label></FieldError>
        <FieldError errors={state.fieldErrors} name="tiktokUrl"><label>TikTok URL<input defaultValue={links.tiktokUrl ?? ""} name="tiktokUrl" placeholder="https://tiktok.com/@your-store" type="url" /></label></FieldError>
        <FieldError errors={state.fieldErrors} name="linkedinUrl"><label>LinkedIn URL<input defaultValue={links.linkedinUrl ?? ""} name="linkedinUrl" placeholder="https://linkedin.com/company/your-store" type="url" /></label></FieldError>
        <FieldError errors={state.fieldErrors} name="whatsappNumber"><label>WhatsApp Number<input defaultValue={settings.whatsappNumber ?? ""} name="whatsappNumber" placeholder="+880 1XXX-XXXXXX" type="tel" /></label></FieldError>
      </div>
      <div className="form-actions"><Button className="primary action-button" disabled={isPending} type="submit">{isPending ? "Saving..." : "Save social profiles"}</Button></div>
    </form>
  );
}

function FieldError({ children, errors, name }: { children: ReactNode; errors?: Record<string, string> | undefined; name: string }) {
  return <div className="field-shell">{children}{errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}</div>;
}
