import { z } from "zod";

export const mediaUsageTypes = ["PRODUCT", "CATEGORY", "LOGO", "FAVICON", "HERO", "GENERAL"] as const;

export const maxMediaUploadSize = 5 * 1024 * 1024;
export const mediaSvgMimeType = "image/svg+xml";

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
