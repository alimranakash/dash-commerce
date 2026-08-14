"use client";

import { Button } from "@dash/ui";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { uploadMediaAction } from "../media.actions";
import { acceptAttributeForUsage, mediaUsageTypes, type MediaUsageType } from "../media.schema";

/**
 * The library page keeps its own form rather than the picker modal: this is the
 * one place a seller chooses the usage type, which is what decides whether an
 * SVG or ICO upload is allowed at all.
 */
export function MediaUploadForm() {
  const router = useRouter();
  const [usageType, setUsageType] = useState<MediaUsageType>("GENERAL");
  const [file, setFile] = useState<File | null>(null);
  const [alt, setAlt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  // Bumped after a successful upload to reset the uncontrolled file input.
  const [fileInputKey, setFileInputKey] = useState(0);

  async function handleUpload() {
    if (!file || uploading) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("usageType", usageType);

      if (alt.trim()) {
        formData.set("alt", alt.trim());
      }

      const result = await uploadMediaAction(formData);

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      setFile(null);
      setAlt("");
      setFileInputKey((current) => current + 1);
      router.refresh();
    } catch {
      setError("Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="resource-form media-upload-form">
      {error ? <p className="form-error">{error}</p> : null}
      <div className="form-grid">
        <label>
          Image
          <input
            accept={acceptAttributeForUsage(usageType)}
            key={fileInputKey}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            type="file"
          />
        </label>
        <label>
          Usage
          <select
            onChange={(event) => setUsageType(event.target.value as MediaUsageType)}
            value={usageType}
          >
            {mediaUsageTypes.map((usage) => (
              <option key={usage} value={usage}>
                {usage.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Alt text
        <input
          onChange={(event) => setAlt(event.target.value)}
          placeholder="Describe the image for accessibility"
          type="text"
          value={alt}
        />
      </label>
      <div className="form-actions">
        <Button
          className="primary action-button"
          disabled={!file || uploading}
          onClick={handleUpload}
          type="button"
        >
          {uploading ? "Uploading..." : "Upload image"}
        </Button>
      </div>
    </div>
  );
}
