import { z } from "zod";

export const mediaUsageTypes = ["PRODUCT", "CATEGORY", "LOGO", "FAVICON", "HERO", "GENERAL"] as const;

export const uploadMediaSchema = z.object({
  alt: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((value) => value || undefined),
  usageType: z.enum(mediaUsageTypes).default("GENERAL")
});

export type MediaUsageType = (typeof mediaUsageTypes)[number];
export type UploadMediaInput = z.infer<typeof uploadMediaSchema>;
