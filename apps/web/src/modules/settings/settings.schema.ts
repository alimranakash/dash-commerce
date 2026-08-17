import { z } from "zod";
import type { StorefrontAdvancedSettings } from "../storefront/customization";

const optionalUrlSchema = z
  .union([z.url("Use a valid URL."), z.literal(""), z.null(), z.undefined()])
  .transform((value) => (value ? value : undefined));

// Locally stored media is served from a root-relative path (`/uploads/...`) unless
// STORAGE_PUBLIC_URL is configured, so image fields accept both forms.
const optionalImageUrlSchema = z
  .union([
    z.url("Use a valid URL."),
    z.string().trim().regex(/^\/[^\s]*$/, "Use a valid URL or upload path."),
    z.literal(""),
    z.null(),
    z.undefined()
  ])
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
  logoUrl: optionalImageUrlSchema,
  faviconUrl: optionalImageUrlSchema,
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
  heroImageUrl: optionalImageUrlSchema,
  announcementText: optionalTextSchema(180),
  featuredSectionTitle: z
    .string()
    .trim()
    .min(2, "Featured section title is required.")
    .max(120),
  advancedSettings: z.custom<StorefrontAdvancedSettings>().optional()
});

// Marketing settings moved out of `moduleSettings` to the `MarketingSetting`
// table: the fields are structured IDs now, and the Conversions API token is a
// secret that must not live in a plaintext JSON column. Any legacy
// `moduleSettings.marketing` blob is simply ignored — nothing ever read it.
// See modules/marketing/.

export const courierProviderKeys = ["pathao", "steadfast", "redx", "paperfly", "carrybee"] as const;

export const courierProviderFields: Record<CourierProviderKey, string[]> = {
  carrybee: ["baseUrl", "clientId", "clientSecret", "clientContext"],
  paperfly: ["baseUrl", "username", "password", "apiKey"],
  pathao: ["baseUrl", "storeId", "clientId", "clientSecret", "clientEmail", "clientPassword"],
  redx: ["baseUrl", "storeId", "apiToken"],
  steadfast: ["baseUrl", "apiKey", "secretKey"]
};

export const courierSettingsSchema = z.object({
  providers: z.array(
    z.object({
      credentials: z.record(z.string().trim().min(1).max(60), z.string().trim().max(400)),
      isEnabled: z.boolean(),
      key: z.enum(courierProviderKeys)
    })
  )
});

export const invoiceSettingsSchema = z.object({
  autoGenerateNumber: z.boolean(),
  companyLogoUrl: optionalImageUrlSchema,
  companyName: optionalTextSchema(120),
  contactEmail: optionalEmailSchema,
  contactPhone: optionalTextSchema(40),
  footerNote: optionalTextSchema(1000),
  invoiceAddressHtml: optionalTextSchema(4000),
  invoicePrefix: z.string().trim().max(12).default("INV"),
  showCustomerEmail: z.boolean(),
  showCustomerPhone: z.boolean(),
  showStoreLogo: z.boolean(),
  showTaxBreakdown: z.boolean(),
  startingInvoiceNumber: z.coerce.number().int().min(0).max(1000000).default(1),
  taxEnabled: z.boolean(),
  taxLabel: optionalTextSchema(40),
  taxPercentage: z.coerce.number().min(0).max(100).default(0),
  thankYouMessage: optionalTextSchema(320),
  vatNumber: optionalTextSchema(60),
  websiteUrl: optionalUrlSchema
});

export const socialLoginSettingsSchema = z
  .object({
    facebookAppId: optionalTextSchema(200),
    facebookAppSecret: optionalTextSchema(300),
    facebookEnabled: z.boolean(),
    googleClientId: optionalTextSchema(200),
    googleClientSecret: optionalTextSchema(300),
    googleEnabled: z.boolean()
  })
  .superRefine((value, ctx) => {
    if (value.facebookEnabled && !value.facebookAppId) {
      ctx.addIssue({ code: "custom", message: "Facebook App ID is required when login is enabled.", path: ["facebookAppId"] });
    }

    if (value.facebookEnabled && !value.facebookAppSecret) {
      ctx.addIssue({ code: "custom", message: "Facebook App Secret is required when login is enabled.", path: ["facebookAppSecret"] });
    }

    if (value.googleEnabled && !value.googleClientId) {
      ctx.addIssue({ code: "custom", message: "Google Client ID is required when login is enabled.", path: ["googleClientId"] });
    }

    if (value.googleEnabled && !value.googleClientSecret) {
      ctx.addIssue({ code: "custom", message: "Google Client Secret is required when login is enabled.", path: ["googleClientSecret"] });
    }
  });

export const socialProfileLinksSchema = z.object({
  linkedinUrl: optionalUrlSchema,
  tiktokUrl: optionalUrlSchema,
  twitterUrl: optionalUrlSchema,
  youtubeUrl: optionalUrlSchema
});

/**
 * Order-verification policy. Off by default, so a store that does not use the
 * Verification Queue is unaffected by the courier guard.
 */
export const verificationSettingsSchema = z.object({
  blockCourierUntilVerified: z.boolean()
});

export const DEFAULT_INVOICE_SETTINGS: InvoiceSettingsInput = {
  autoGenerateNumber: true,
  companyLogoUrl: undefined,
  companyName: undefined,
  contactEmail: undefined,
  contactPhone: undefined,
  footerNote: undefined,
  invoiceAddressHtml: undefined,
  invoicePrefix: "INV",
  showCustomerEmail: true,
  showCustomerPhone: true,
  showStoreLogo: true,
  showTaxBreakdown: true,
  startingInvoiceNumber: 1,
  taxEnabled: false,
  taxLabel: undefined,
  taxPercentage: 0,
  thankYouMessage: undefined,
  vatNumber: undefined,
  websiteUrl: undefined
};

export const DEFAULT_SOCIAL_LOGIN_SETTINGS: SocialLoginSettingsInput = {
  facebookAppId: undefined,
  facebookAppSecret: undefined,
  facebookEnabled: false,
  googleClientId: undefined,
  googleClientSecret: undefined,
  googleEnabled: false
};

export const DEFAULT_VERIFICATION_SETTINGS: VerificationSettingsInput = {
  blockCourierUntilVerified: false
};

export const DEFAULT_MODULE_SETTINGS: ModuleSettings = {
  courier: { providers: [] },
  invoice: DEFAULT_INVOICE_SETTINGS,
  socialLogin: DEFAULT_SOCIAL_LOGIN_SETTINGS,
  socialProfiles: {
    linkedinUrl: undefined,
    tiktokUrl: undefined,
    twitterUrl: undefined,
    youtubeUrl: undefined
  },
  verification: DEFAULT_VERIFICATION_SETTINGS
};

export function normalizeModuleSettings(value: unknown): ModuleSettings {
  const source = (value ?? {}) as Record<string, unknown>;

  return {
    courier: parseSection(courierSettingsSchema, source.courier, DEFAULT_MODULE_SETTINGS.courier),
    invoice: parseSection(invoiceSettingsSchema, source.invoice, DEFAULT_INVOICE_SETTINGS),
    socialLogin: parseSection(socialLoginSettingsSchema, source.socialLogin, DEFAULT_SOCIAL_LOGIN_SETTINGS),
    socialProfiles: parseSection(socialProfileLinksSchema, source.socialProfiles, DEFAULT_MODULE_SETTINGS.socialProfiles),
    verification: parseSection(verificationSettingsSchema, source.verification, DEFAULT_VERIFICATION_SETTINGS)
  };
}

function parseSection<T>(schema: { safeParse: (input: unknown) => { success: boolean; data?: T } }, input: unknown, fallback: T): T {
  const result = schema.safeParse(input);

  return result.success && result.data ? result.data : fallback;
}

export type CourierProviderKey = (typeof courierProviderKeys)[number];
export type CourierSettingsInput = z.infer<typeof courierSettingsSchema>;
export type InvoiceSettingsInput = z.infer<typeof invoiceSettingsSchema>;
export type SocialLoginSettingsInput = z.infer<typeof socialLoginSettingsSchema>;
export type SocialProfileLinksInput = z.infer<typeof socialProfileLinksSchema>;
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;
export type ThemeSettingsInput = z.infer<typeof themeSettingsSchema>;
export type VerificationSettingsInput = z.infer<typeof verificationSettingsSchema>;

export type ModuleSettings = {
  courier: CourierSettingsInput;
  invoice: InvoiceSettingsInput;
  socialLogin: SocialLoginSettingsInput;
  socialProfiles: SocialProfileLinksInput;
  verification: VerificationSettingsInput;
};
