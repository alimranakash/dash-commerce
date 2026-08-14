"use client";

import { useState } from "react";
import { MediaPicker, MediaPickerField } from "../../media/components/media-picker";
import type { MediaPickerAsset } from "../../media/media.types";

type ProductImageSlotsProps = {
  imageUrls?: string[] | undefined;
};

// Slot 0 is the main image; the rest are the gallery. The hidden input names
// stay exactly what the product action already reads.
const slotCount = 4;

export function ProductImageSlots({ imageUrls = [] }: ProductImageSlotsProps) {
  const [urls, setUrls] = useState<string[]>(() =>
    Array.from({ length: slotCount }, (_, index) => imageUrls[index] ?? "")
  );
  const [open, setOpen] = useState(false);
  const filledCount = urls.filter(Boolean).length;

  function setSlot(index: number, url: string) {
    setUrls((current) => current.map((entry, position) => (position === index ? url : entry)));
  }

  function fillEmptySlots(assets: MediaPickerAsset[]) {
    setUrls((current) => {
      const next = [...current];
      let cursor = 0;

      for (const asset of assets) {
        while (cursor < next.length && next[cursor]) {
          cursor += 1;
        }

        if (cursor >= next.length) {
          break;
        }

        next[cursor] = asset.url;
        cursor += 1;
      }

      return next;
    });
  }

  return (
    <>
      <div className="product-image-slot-actions">
        <button
          className="media-picker-choose"
          disabled={filledCount >= slotCount}
          onClick={() => setOpen(true)}
          type="button"
        >
          Add from library
        </button>
        <span>
          {filledCount} of {slotCount} images
        </span>
      </div>
      <div className="product-image-slots">
        {urls.map((url, index) => (
          <MediaPickerField
            description={index === 0 ? "Shown first on the storefront." : "Optional gallery image."}
            key={index}
            label={index === 0 ? "Main Image" : `Gallery Image ${index}`}
            name={index === 0 ? "mainImageUrl" : `galleryImageUrl${index - 1}`}
            onChange={(nextUrl) => setSlot(index, nextUrl)}
            usageType="PRODUCT"
            value={url}
          />
        ))}
      </div>
      <MediaPicker
        multiple
        onClose={() => setOpen(false)}
        onSelect={fillEmptySlots}
        open={open}
        title="Add product images"
        usageType="PRODUCT"
      />
    </>
  );
}
