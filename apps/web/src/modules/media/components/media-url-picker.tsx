"use client";

import type { MediaPickerAsset } from "../media.types";

type MediaUrlPickerProps = {
  assets: MediaPickerAsset[];
  label?: string;
  onSelect: (url: string) => void;
};

export function MediaUrlPicker({ assets, label = "Use uploaded media", onSelect }: MediaUrlPickerProps) {
  if (assets.length === 0) {
    return (
      <p className="media-picker-empty">
        Upload images in Media Library, then use them here.
      </p>
    );
  }

  return (
    <div className="media-picker">
      <span>{label}</span>
      <div>
        {assets.map((asset) => (
          <button key={asset.id} onClick={() => onSelect(asset.url)} type="button">
            {asset.filename}
          </button>
        ))}
      </div>
    </div>
  );
}
