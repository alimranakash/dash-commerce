"use client";

import { ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { MediaPickerAsset } from "../../media/media.types";

type SettingsCardProps = {
  children: ReactNode;
  description?: string;
  title: string;
};

export function SettingsCard({ children, description, title }: SettingsCardProps) {
  return (
    <section className="theme-settings-card">
      <div className="theme-settings-card-header">
        <div>
          <h2>{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      <div className="theme-settings-card-body">{children}</div>
    </section>
  );
}

export function UploadField({
  accept = "image/jpeg,image/png,image/webp,image/svg+xml",
  assets = [],
  fileName,
  label,
  name,
  value
}: {
  accept?: string;
  assets?: MediaPickerAsset[];
  fileName: string;
  label: string;
  name: string;
  value?: string | null | undefined;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedUrl, setSelectedUrl] = useState(value ?? "");
  const [previewUrl, setPreviewUrl] = useState(value ?? "");

  useEffect(() => {
    setSelectedUrl(value ?? "");
    setPreviewUrl(value ?? "");
  }, [value]);

  const imageAssets = useMemo(() => assets.filter((asset) => asset.url), [assets]);

  return (
    <div className="theme-upload-field">
      <input name={name} type="hidden" value={selectedUrl} />
      <div className="theme-upload-label-row">
        <span>{label}</span>
        {previewUrl ? (
          <button
            className="theme-upload-remove"
            onClick={() => {
              if (fileInputRef.current) {
                fileInputRef.current.value = "";
              }

              setSelectedUrl("");
              setPreviewUrl("");
            }}
            type="button"
          >
            <Trash2 className="h-4 w-4" />
            Remove
          </button>
        ) : null}
      </div>
      <div className="theme-upload-box">
        <div className="theme-upload-preview">
          {previewUrl ? <img alt={`${label} preview`} src={previewUrl} /> : <ImagePlus className="h-8 w-8" />}
        </div>
        <div className="theme-upload-actions">
          <label className="theme-upload-button">
            Upload
            <input
              accept={accept}
              name={fileName}
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (!file) {
                  return;
                }

                const objectUrl = URL.createObjectURL(file);
                setSelectedUrl("");
                setPreviewUrl(objectUrl);
              }}
              ref={fileInputRef}
              type="file"
            />
          </label>
          {imageAssets.length > 0 ? (
            <select
              aria-label={`Select existing ${label}`}
              onChange={(event) => {
                const url = event.target.value;

                if (url) {
                  setSelectedUrl(url);
                  setPreviewUrl(url);
                }
              }}
              value=""
            >
              <option value="">Use media library</option>
              {imageAssets.map((asset) => (
                <option key={asset.id} value={asset.url}>
                  {asset.filename}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ColorPickerField({ label, name, value }: { label: string; name: string; value: string }) {
  const [color, setColor] = useState(value);

  return (
    <label className="theme-color-field">
      {label}
      <span>
        <input name={name} onChange={(event) => setColor(event.target.value)} type="color" value={color} />
        <input aria-label={`${label} hex`} onChange={(event) => setColor(event.target.value)} pattern="^#[0-9a-fA-F]{6}$" type="text" value={color} />
      </span>
    </label>
  );
}

export function ToggleField({ label, name, value }: { label: string; name: string; value: boolean }) {
  return (
    <label className="theme-toggle-field">
      <span>{label}</span>
      <input defaultChecked={value} name={name} type="checkbox" />
    </label>
  );
}
