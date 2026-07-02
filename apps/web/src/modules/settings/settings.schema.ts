import { z } from "zod";
import type { StorefrontAdvancedSettings } from "../storefront/customization";

const optionalUrlSchema = z
  .union([z.url("Use a valid URL."), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : undefined));

const optionalEmailSchema = z
  .union([z.email("Use a valid email address."), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : undefined));

const optionalTextSchema = (max = 320) =>
  z
    .union([z.string().trim().max(max), z.literal(""), z.null(), z.undefined()])
    .transform((value) => (value ? value : undefined));

const colorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex color.");

const optionalColorSchema = z
  .union([colorSchema, z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : undefined));

export const storeSettingsSchema = z.object({
  logoUrl: optionalUrlSchema,
  faviconUrl: optionalUrlSchema,
  tagline: optionalTextSchema(180),
  contactEmail: optionalEmailSchema,
  contactPhone: optionalTextSchema(40),
  supportPhone: optionalTextSchema(40),
  businessAddress: optionalTextSchema(600),
  facebookUrl: optionalUrlSchema,
  instagramUrl: optionalUrlSchema,
  whatsappNumber: optionalTextSchema(40)
});

export const themeSettingsSchema = z.object({
  themeName: z.literal("Theme v1").default("Theme v1"),
  primaryColor: colorSchema.default("#135d66"),
  secondaryColor: optionalColorSchema,
  heroTitle: z.string().trim().min(2, "Hero title is required.").max(120),
  heroSubtitle: optionalTextSchema(320),
  heroImageUrl: optionalUrlSchema,
  announcementText: optionalTextSchema(180),
  featuredSectionTitle: z
    .string()
    .trim()
    .min(2, "Featured section title is required.")
    .max(120),
  advancedSettings: z.custom<StorefrontAdvancedSettings>().optional()
});

export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
export type ThemeSettingsInput = z.infer<typeof themeSettingsSchema>;
