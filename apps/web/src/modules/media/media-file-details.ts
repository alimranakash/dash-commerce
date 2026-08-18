"use client";

import { useEffect, useState } from "react";
import {
  formatMediaSize,
  mediaDimensionWarningForUsage,
  mediaSizeErrorForUsage,
  type MediaUsageType
} from "./media.schema";
import type { MediaPickerAsset } from "./media.types";

type ImageDimensions = { height: number; width: number };

export type MediaFileDetails = {
  /** Blocking: the file is over the usage's cap and the server would reject it. */
  error: string | null;
  /** "1200 x 1200 px - 143KB", once the browser has decoded the file. */
  summary: string | null;
  /** Advisory: dimensions are off the recommendation but the upload is allowed. */
  warning: string | null;
};

/**
 * Reads the picked file in the browser so a seller sees the real dimensions and
 * weight before uploading. The size rule is the same function the server action
 * runs, so this is a faster no rather than a second, looser one.
 */
export function useMediaFileDetails(
  file: File | null,
  usageType: MediaUsageType
): MediaFileDetails {
  const [dimensions, setDimensions] = useState<ImageDimensions | null>(null);

  useEffect(() => {
    if (!file) {
      setDimensions(null);
      return;
    }

    let cancelled = false;

    void readImageDimensions(file).then((measured) => {
      if (!cancelled) {
        setDimensions(measured);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [file]);

  if (!file) {
    return { error: null, summary: null, warning: null };
  }

  const error = mediaSizeErrorForUsage(file.size, usageType);
  const measurement = dimensions ? `${dimensions.width} x ${dimensions.height} px - ` : "";

  return {
    error,
    summary: `${measurement}${formatMediaSize(file.size)}`,
    warning: !error && dimensions ? mediaDimensionWarningForUsage(dimensions, usageType) : null
  };
}

/**
 * Confirms what the server actually stored. Sellers hand over a 4MB photo, so
 * the saving is worth showing rather than leaving them to wonder.
 */
export function describeStoredAsset(asset: MediaPickerAsset, originalSize: number): string {
  const measurement = asset.width && asset.height ? `${asset.width} x ${asset.height} px, ` : "";
  const saving =
    originalSize > asset.size ? ` — down from ${formatMediaSize(originalSize)}` : "";

  return `Saved ${asset.filename} (${measurement}${formatMediaSize(asset.size)})${saving}.`;
}

async function readImageDimensions(file: File): Promise<ImageDimensions | null> {
  if (typeof window === "undefined" || !file.type.startsWith("image/")) {
    return null;
  }

  const objectUrl = URL.createObjectURL(file);

  try {
    return await new Promise<ImageDimensions | null>((resolve) => {
      const image = new window.Image();

      // A dimensionless SVG reports 0, which is worse than saying nothing.
      image.onload = () =>
        resolve(
          image.naturalWidth > 0 && image.naturalHeight > 0
            ? { height: image.naturalHeight, width: image.naturalWidth }
            : null
        );
      image.onerror = () => resolve(null);
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
