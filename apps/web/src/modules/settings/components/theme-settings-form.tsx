"use client";

import { Button } from "@dash/ui";
import { useActionState, useState, type ReactNode } from "react";
import { MediaUrlPicker } from "../../media/components/media-url-picker";
import type { MediaPickerAsset } from "../../media/media.types";
import type { SettingsActionState } from "../settings.actions";

export type ThemeSettingsFormValue = {
  themeName: string;
  primaryColor: string;
  secondaryColor?: string | null;
  heroTitle: string;
  heroSubtitle?: string | null;
  heroImageUrl?: string | null;
  announcementText?: string | null;
  featuredSectionTitle: string;
};

type ThemeSettingsFormProps = {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  mediaAssets?: MediaPickerAsset[];
  settings: ThemeSettingsFormValue;
};

const initialState: SettingsActionState = {
  status: "idle"
};

export function ThemeSettingsForm({ action, mediaAssets = [], settings }: ThemeSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [heroImageUrl, setHeroImageUrl] = useState(settings.heroImageUrl ?? "");

  return (
    <form action={formAction} className="resource-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-section-heading">
        <h2>Theme</h2>
        <p>Theme v1 keeps storefront customization polished and hard to break.</p>
      </div>
      <div className="form-grid">
        <label>
          Theme name
          <input name="themeName" readOnly value={settings.themeName} />
        </label>
        <FieldError errors={state.fieldErrors} name="primaryColor">
          <label>
            Primary color
            <span className="color-input-row">
              <input
                defaultValue={settings.primaryColor}
                name="primaryColor"
                type="color"
              />
              <input
                defaultValue={settings.primaryColor}
                aria-label="Primary color hex"
                pattern="^#[0-9a-fA-F]{6}$"
                readOnly
                type="text"
              />
            </span>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="secondaryColor">
          <label>
            Secondary color
            <input
              defaultValue={settings.secondaryColor ?? ""}
              name="secondaryColor"
              placeholder="#c89356"
              type="text"
            />
          </label>
        </FieldError>
      </div>
      <div className="form-section-heading">
        <h2>Homepage</h2>
        <p>These fields power the public storefront hero and featured products section.</p>
      </div>
      <FieldError errors={state.fieldErrors} name="announcementText">
        <label>
          Announcement text
          <input
            defaultValue={settings.announcementText ?? ""}
            name="announcementText"
            type="text"
          />
        </label>
      </FieldError>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="heroTitle">
          <label>
            Hero title
            <input defaultValue={settings.heroTitle} name="heroTitle" required type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="featuredSectionTitle">
          <label>
            Featured section title
            <input
              defaultValue={settings.featuredSectionTitle}
              name="featuredSectionTitle"
              required
              type="text"
            />
          </label>
        </FieldError>
      </div>
      <FieldError errors={state.fieldErrors} name="heroSubtitle">
        <label>
          Hero subtitle
          <textarea defaultValue={settings.heroSubtitle ?? ""} name="heroSubtitle" rows={4} />
        </label>
      </FieldError>
      <FieldError errors={state.fieldErrors} name="heroImageUrl">
        <label>
          Hero image URL
          <input
            name="heroImageUrl"
            onChange={(event) => setHeroImageUrl(event.target.value)}
            type="url"
            value={heroImageUrl}
          />
        </label>
        <MediaUrlPicker assets={mediaAssets} onSelect={setHeroImageUrl} />
      </FieldError>
      <div className="form-actions">
        <Button className="primary action-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save theme"}
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
