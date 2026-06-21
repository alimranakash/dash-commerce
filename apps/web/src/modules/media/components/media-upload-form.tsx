"use client";

import { Button } from "@dash/ui";
import { useActionState } from "react";
import type { MediaUploadActionState } from "../media.actions";
import { mediaUsageTypes } from "../media.schema";

type MediaUploadFormProps = {
  action: (state: MediaUploadActionState, formData: FormData) => Promise<MediaUploadActionState>;
};

const initialState: MediaUploadActionState = {
  status: "idle"
};

export function MediaUploadForm({ action }: MediaUploadFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form media-upload-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-grid">
        <label>
          Image
          <input accept="image/jpeg,image/png,image/webp,image/svg+xml" name="file" required type="file" />
        </label>
        <label>
          Usage
          <select defaultValue="GENERAL" name="usageType">
            {mediaUsageTypes.map((usageType) => (
              <option key={usageType} value={usageType}>
                {usageType.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Alt text
        <input name="alt" placeholder="Describe the image for accessibility" type="text" />
      </label>
      <div className="form-actions">
        <Button className="primary action-button" disabled={isPending} type="submit">
          {isPending ? "Uploading..." : "Upload image"}
        </Button>
      </div>
    </form>
  );
}
