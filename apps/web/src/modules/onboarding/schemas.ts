import { z } from "zod";

export const storeSlugSchema = z
  .string()
  .trim()
  .regex(/^[a-z0-9-]{3,40}$/, "Use 3-40 lowercase letters, numbers, or hyphens.")
  .refine((value) => !value.startsWith("-") && !value.endsWith("-"), {
    message: "Slug cannot start or end with a hyphen."
  });

export const onboardingSchema = z.object({
  organizationName: z.string().trim().min(2, "Organization name is required.").max(100),
  storeName: z.string().trim().min(2, "Store name is required.").max(100),
  storeSlug: storeSlugSchema,
  businessType: z.string().trim().min(2, "Business type is required.").max(80),
  country: z.string().trim().min(2, "Country is required.").max(80),
  currency: z.string().trim().length(3, "Use a 3-letter currency code.").toUpperCase(),
  timezone: z.string().trim().min(2, "Timezone is required.").max(80)
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
