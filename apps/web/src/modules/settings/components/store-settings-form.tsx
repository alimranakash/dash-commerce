"use client";

import { Button } from "@dash/ui";
import { useActionState, type ReactNode } from "react";
import type { SettingsActionState } from "../settings.actions";

export type StoreSettingsFormValue = {
  logoUrl?: string | null;
  faviconUrl?: string | null;
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
  settings: StoreSettingsFormValue;
};

const initialState: SettingsActionState = {
  status: "idle"
};

export function StoreSettingsForm({ action, settings }: StoreSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-section-heading">
        <h2>Brand assets</h2>
        <p>Use hosted image URLs for now. Uploads will be added later.</p>
      </div>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="logoUrl">
          <label>
            Logo URL
            <input defaultValue={settings.logoUrl ?? ""} name="logoUrl" type="url" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="faviconUrl">
          <label>
            Favicon URL
            <input defaultValue={settings.faviconUrl ?? ""} name="faviconUrl" type="url" />
          </label>
        </FieldError>
      </div>
      <div className="form-section-heading">
        <h2>Contact</h2>
        <p>Shown in the storefront footer and used for customer trust signals.</p>
      </div>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="contactEmail">
          <label>
            Contact email
            <input defaultValue={settings.contactEmail ?? ""} name="contactEmail" type="email" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="contactPhone">
          <label>
            Contact phone
            <input defaultValue={settings.contactPhone ?? ""} name="contactPhone" type="tel" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="supportPhone">
          <label>
            Support phone
            <input defaultValue={settings.supportPhone ?? ""} name="supportPhone" type="tel" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="whatsappNumber">
          <label>
            WhatsApp number
            <input defaultValue={settings.whatsappNumber ?? ""} name="whatsappNumber" type="tel" />
          </label>
        </FieldError>
      </div>
      <FieldError errors={state.fieldErrors} name="businessAddress">
        <label>
          Business address
          <textarea
            defaultValue={settings.businessAddress ?? ""}
            name="businessAddress"
            rows={4}
          />
        </label>
      </FieldError>
      <div className="form-section-heading">
        <h2>Social links</h2>
        <p>Optional public links for customers.</p>
      </div>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="facebookUrl">
          <label>
            Facebook URL
            <input defaultValue={settings.facebookUrl ?? ""} name="facebookUrl" type="url" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="instagramUrl">
          <label>
            Instagram URL
            <input defaultValue={settings.instagramUrl ?? ""} name="instagramUrl" type="url" />
          </label>
        </FieldError>
      </div>
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
