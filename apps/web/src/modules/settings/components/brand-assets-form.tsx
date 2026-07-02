"use client";

import { Button } from "@dash/ui";
import { useActionState } from "react";
import type { MediaPickerAsset } from "../../media/media.types";
import type { SettingsActionState } from "../settings.actions";
import type { StoreSettingsFormValue } from "./store-settings-form";
import { SettingsCard, UploadField } from "./theme-form-fields";

const initialState: SettingsActionState = { status: "idle" };

export function BrandAssetsForm({ action, mediaAssets, settings }: {
  action: (state: SettingsActionState, formData: FormData) => Promise<SettingsActionState>;
  mediaAssets: MediaPickerAsset[];
  settings: StoreSettingsFormValue;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="theme-settings-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <SettingsCard
        title="Branding"
        description="Upload the storefront logo and browser favicon. Existing media can be selected from your library."
      >
        <div className="theme-settings-grid two">
          <UploadField
            assets={mediaAssets}
            fileName="logoFile"
            label="Store Logo"
            name="logoUrl"
            value={settings.logoUrl}
          />
          <UploadField
            accept="image/jpeg,image/png,image/webp,image/svg+xml,image/x-icon"
            assets={mediaAssets}
            fileName="faviconFile"
            label="Favicon"
            name="faviconUrl"
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
