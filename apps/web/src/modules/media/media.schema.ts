import { z } from "zod";

export const mediaUsageTypes = ["PRODUCT", "CATEGORY", "LOGO", "FAVICON", "HERO", "GENERAL"] as const;

export const mediaSvgMimeType = "image/svg+xml";

const kilobyte = 1024;
const megabyte = 1024 * 1024;

export type MediaUploadGuide = {
  /**
   * Whether the server downscales to the recommended box and re-encodes as WebP.
   * Off for favicons, where the browser-facing format has to survive intact.
   */
  autoOptimize: boolean;
  /**
   * Hard ceiling on the *uploaded* file, rejected in the browser and on the
   * server. What ends up stored is governed by the recommended box below,
   * because `autoOptimize` re-encodes anything larger.
   */
  maxSize: number;
  /** What the seller should export before uploading. */
  recommendedFormat: string;
  recommendedHeight: number;
  recommendedSize: number;
  recommendedWidth: number;
};

/**
 * Per-usage image budget. `maxSize` is only a guard against absurd uploads —
 * sized to clear what a phone's default camera mode produces (3-5MB) so sellers
 * are not stopped by their own photos, while still refusing 108MP-mode files.
 * The optimiser turns whatever arrives into a ~180KB WebP at the recommended
 * dimensions. Favicons are the exception: they are stored exactly as uploaded,
 * so their cap is the real limit.
 */
export const mediaUploadGuides: Record<MediaUsageType, MediaUploadGuide> = {
  CATEGORY: {
    autoOptimize: true,
    maxSize: 6 * megabyte,
    recommendedFormat: "WebP",
    recommendedHeight: 900,
    recommendedSize: 200 * kilobyte,
    recommendedWidth: 1200
  },
  FAVICON: {
    autoOptimize: false,
    maxSize: 512 * kilobyte,
    recommendedFormat: "PNG",
    recommendedHeight: 512,
    recommendedSize: 50 * kilobyte,
    recommendedWidth: 512
  },
  GENERAL: {
    autoOptimize: true,
    maxSize: 6 * megabyte,
    recommendedFormat: "WebP",
    recommendedHeight: 1200,
    recommendedSize: 300 * kilobyte,
    recommendedWidth: 1600
  },
  HERO: {
    autoOptimize: true,
    maxSize: 6 * megabyte,
    recommendedFormat: "WebP",
    recommendedHeight: 1080,
    recommendedSize: 400 * kilobyte,
    recommendedWidth: 1920
  },
  LOGO: {
    autoOptimize: true,
    maxSize: 6 * megabyte,
    recommendedFormat: "WebP or PNG",
    recommendedHeight: 512,
    recommendedSize: 100 * kilobyte,
    recommendedWidth: 512
  },
  PRODUCT: {
    autoOptimize: true,
    maxSize: 6 * megabyte,
    recommendedFormat: "WebP",
    recommendedHeight: 1200,
    recommendedSize: 200 * kilobyte,
    recommendedWidth: 1200
  }
};

/** Anything below this share of the recommended size is likely to look soft. */
const softDimensionRatio = 0.75;
/** Anything above this is wasted bytes the storefront has to download. */
const oversizedDimensionRatio = 2;

export function mediaUploadGuideForUsage(usageType: MediaUsageType): MediaUploadGuide {
  return mediaUploadGuides[usageType];
}

export function formatMediaSize(bytes: number): string {
  if (bytes >= megabyte) {
    return `${Number((bytes / megabyte).toFixed(1))}MB`;
  }

  return `${Math.max(1, Math.round(bytes / kilobyte))}KB`;
}

/** The "aim for this" line rendered next to every upload control. */
export function mediaUploadHintForUsage(usageType: MediaUsageType): string {
  const guide = mediaUploadGuides[usageType];
  const target = `${guide.recommendedWidth} x ${guide.recommendedHeight} px`;
  const limit = `Max ${formatMediaSize(guide.maxSize)}.`;

  if (guide.autoOptimize) {
    return `Best at ${target}. Larger uploads are resized and converted to WebP automatically. ${limit}`;
  }

  return `Recommended ${target}, ${guide.recommendedFormat}, under ${formatMediaSize(guide.recommendedSize)}. ${limit}`;
}

/**
 * Shared by the browser pre-check and the server action so a rejected upload
 * reads the same either way, and so the server stays the real gate.
 */
export function mediaSizeErrorForUsage(size: number, usageType: MediaUsageType): string | null {
  const guide = mediaUploadGuides[usageType];

  if (size <= guide.maxSize) {
    return null;
  }

  const problem = `Image must be ${formatMediaSize(guide.maxSize)} or smaller, but this one is ${formatMediaSize(size)}.`;

  if (guide.autoOptimize) {
    return `${problem} Resize it to around ${guide.recommendedWidth} x ${guide.recommendedHeight} px and upload again.`;
  }

  return `${problem} Export it at ${guide.recommendedWidth} x ${guide.recommendedHeight} px in ${guide.recommendedFormat} to land under ${formatMediaSize(guide.recommendedSize)}.`;
}

/** Advisory only — dimensions never block an upload. */
export function mediaDimensionWarningForUsage(
  dimensions: { height: number; width: number },
  usageType: MediaUsageType
): string | null {
  const guide = mediaUploadGuides[usageType];
  const target = `${guide.recommendedWidth} x ${guide.recommendedHeight} px`;

  if (
    dimensions.width < guide.recommendedWidth * softDimensionRatio ||
    dimensions.height < guide.recommendedHeight * softDimensionRatio
  ) {
    return `Smaller than the recommended ${target} — it may look soft on the storefront.`;
  }

  // Oversized art is only worth flagging where the server won't downscale it.
  if (
    !guide.autoOptimize &&
    (dimensions.width > guide.recommendedWidth * oversizedDimensionRatio ||
      dimensions.height > guide.recommendedHeight * oversizedDimensionRatio)
  ) {
    return `Larger than needed. Resizing to ${target} keeps the storefront fast.`;
  }

  return null;
}

const rasterMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
// Browsers report .ico under either name depending on the platform, and the
// branding favicon picker offers .ico, so both have to be accepted there.
const iconMimeTypes = ["image/vnd.microsoft.icon", "image/x-icon"] as const;

export const mediaMimeRuleMessage =
  "Use JPG, PNG, or WebP images. SVG is only allowed for logo or favicon uploads, and ICO only for favicons.";

/**
 * The single source of truth for which files a usage type accepts. Selecting an
 * existing asset in the picker runs through the same rule as uploading a new
 * one, so an SVG uploaded as a logo never becomes a product or hero image.
 */
export function allowedMimeTypesForUsage(usageType: MediaUsageType): string[] {
  if (usageType === "LOGO") {
    return [...rasterMimeTypes, mediaSvgMimeType];
  }

  if (usageType === "FAVICON") {
    return [...rasterMimeTypes, mediaSvgMimeType, ...iconMimeTypes];
  }

  return [...rasterMimeTypes];
}

export function acceptAttributeForUsage(usageType: MediaUsageType): string {
  const mimeTypes = allowedMimeTypesForUsage(usageType);

  return usageType === "FAVICON" ? [...mimeTypes, ".ico"].join(",") : mimeTypes.join(",");
}

export const uploadMediaSchema = z.object({
  alt: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => value || undefined),
  usageType: z.enum(mediaUsageTypes).default("GENERAL")
});

export const listMediaAssetsSchema = z.object({
  // The usage the picker is filling. Drives the mime filter above; separate from
  // `usageType`, which is the optional "show me only logos" library filter.
  context: z.enum(mediaUsageTypes).default("GENERAL"),
  cursor: z.string().trim().min(1).optional(),
  search: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => value || undefined),
  take: z.number().int().min(1).max(48).default(24),
  usageType: z.enum(mediaUsageTypes).optional()
});

export type MediaUsageType = (typeof mediaUsageTypes)[number];
export type UploadMediaInput = z.infer<typeof uploadMediaSchema>;
export type ListMediaAssetsInput = z.input<typeof listMediaAssetsSchema>;
