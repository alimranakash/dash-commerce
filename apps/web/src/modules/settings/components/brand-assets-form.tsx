"use client";

import { Button } from "@dash/ui";
import { useActionState } from "react";
import { MediaPickerField } from "../../media/components/media-picker";
import { StorefrontSettingsToast } from "../../storefront/dashboard/storefront-settings-toast";
import type { SettingsActionState } from "../settings.actions";
import type { StoreSettingsFormValue } from "./store-settings-form";
import { SettingsCard } from "./theme-form-fields";

const initialState: SettingsActionState = { status: "idle" };

export function BrandAssetsForm({ action, settings }: {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  settings: StoreSettingsFormValue;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="theme-settings-form">
      <StorefrontSettingsToast
        message={state.status === "idle" ? null : state.message}
        messageKey={state.toastId}
        type={state.status === "error" ? "error" : "success"}
      />
      <SettingsCard
        title="Branding"
        description="Pick the storefront logo and browser favicon from your media library, or upload new ones."
      >
        <div className="theme-settings-grid two">
          <MediaPickerField
            description="SVG, PNG, JPG, or WebP."
            label="Store Logo"
            name="logoUrl"
            usageType="LOGO"
            value={settings.logoUrl}
          />
          <MediaPickerField
            description="ICO and SVG are allowed here."
            label="Favicon"
            name="faviconUrl"
            usageType="FAVICON"
            value={settings.faviconUrl}
          />
        </div>
        <div className="theme-form-actions">
          <Button className="primary action-button" disabled={isPending} type="submit">
            {isPending ? "Saving..." : "Save branding"}
          </Button>
        </div>
      </SettingsCard>
    </form>
  );
}
