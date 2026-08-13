import { z } from "zod";
import { validateCustomTrackingCode } from "./marketing-code";

/**
 * Structured, ID-based marketing settings.
 *
 * Every platform field is an identifier we validate against its published
 * format — the storefront snippet is generated from a known-safe template per
 * platform, so a seller never pastes a `<script>` tag for these. Only the
 * Custom Tracking block still accepts raw code, and that goes through the
 * allowlist in `marketing-code.ts`.
 */

const idPatterns = {
  ga4MeasurementId: {
    example: "G-XXXXXXXXXX",
    message: "GA4 measurement IDs look like G-XXXXXXXXXX.",
    pattern: /^G-[A-Z0-9]{4,15}$/
  },
  googleAdsConversionId: {
    example: "AW-123456789",
    message: "Google Ads conversion IDs look like AW-123456789.",
    pattern: /^AW-\d{9,12}$/
  },
  googleSiteVerification: {
    example: "8Xk2...content value only",
    message: "Paste only the content value of the verification tag, not the whole <meta> tag.",
    pattern: /^[A-Za-z0-9_-]{20,100}$/
  },
  gtmContainerId: {
    example: "GTM-XXXXXXX",
    message: "GTM container IDs look like GTM-XXXXXXX.",
    pattern: /^GTM-[A-Z0-9]{4,12}$/
  },
  metaDomainVerification: {
    example: "content value only",
    message: "Paste only the content value of the verification tag, not the whole <meta> tag.",
    pattern: /^[a-z0-9]{20,64}$/
  },
  metaPixelId: {
    example: "123456789012345",
    message: "Meta pixel IDs are 10-20 digits.",
    pattern: /^\d{10,20}$/
  },
  tiktokPixelId: {
    example: "CXXXXXXXXXXXXXXXXXXX",
    message: "TikTok pixel IDs are 20 characters, letters and digits.",
    pattern: /^[A-Z0-9]{20}$/
  }
} as const;

export type MarketingIdField = keyof typeof idPatterns;

/**
 * The patterns alone, for re-validating stored values at render time. Kept in
 * this module so the settings form and the storefront can never drift apart on
 * what counts as a well-formed ID.
 */
export const marketingIdPatterns: Record<MarketingIdField, RegExp> = Object.fromEntries(
  Object.entries(idPatterns).map(([key, value]) => [key, value.pattern])
) as Record<MarketingIdField, RegExp>;

export const marketingIdHints: Record<MarketingIdField, { example: string; message: string }> =
  Object.fromEntries(
    Object.entries(idPatterns).map(([key, value]) => [
      key,
      { example: value.example, message: value.message }
    ])
  ) as Record<MarketingIdField, { example: string; message: string }>;

/**
 * Sellers reliably paste the whole tag they were given. Rather than reject that,
 * pull the value we actually want out of it — we still store the ID alone.
 */
export function extractIdValue(field: MarketingIdField, raw: string) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return "";
  }

  const metaContent = /content\s*=\s*["']([^"']+)["']/i.exec(trimmed);

  if (metaContent?.[1]) {
    return metaContent[1].trim();
  }

  if (field === "metaPixelId") {
    const fromPixel = /fbq\(\s*["']init["']\s*,\s*["'](\d{10,20})["']/i.exec(trimmed);

    if (fromPixel?.[1]) {
      return fromPixel[1];
    }
  }

  const inlineId = new RegExp(idPatterns[field].pattern.source.replace(/^\^|\$$/g, "")).exec(
    trimmed
  );

  return inlineId?.[0] ?? trimmed;
}

const optionalId = (field: MarketingIdField) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => (value ? extractIdValue(field, value) : ""))
    .refine((value) => value === "" || idPatterns[field].pattern.test(value), {
      message: idPatterns[field].message
    })
    .transform((value) => (value ? value : undefined));

const optionalCustomCode = (label: string) =>
  z
    .union([z.string(), z.null(), z.undefined()])
    .transform((value) => value?.trim() ?? "")
    .superRefine((value, ctx) => {
      if (!value) {
        return;
      }

      if (value.length > 8000) {
        ctx.addIssue({ code: "custom", message: `${label} must be under 8000 characters.` });
        return;
      }

      for (const problem of validateCustomTrackingCode(value)) {
        ctx.addIssue({ code: "custom", message: problem });
      }
    })
    .transform((value) => (value ? value : undefined));

/** The Conversions API token — a server-side secret, never echoed back. */
const capiTokenSchema = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => value?.trim() ?? "")
  .refine((value) => value === "" || (value.length >= 20 && value.length <= 400), {
    message: "That does not look like a Conversions API access token."
  })
  .refine((value) => value === "" || !/\s/.test(value), {
    message: "Access tokens do not contain spaces."
  })
  .transform((value) => (value ? value : undefined));

export const marketingSettingsSchema = z
  .object({
    customBodyCode: optionalCustomCode("Body code"),
    customEnabled: z.boolean(),
    customFooterCode: optionalCustomCode("Footer code"),
    customHeaderCode: optionalCustomCode("Header code"),
    ga4MeasurementId: optionalId("ga4MeasurementId"),
    googleAdsConversionId: optionalId("googleAdsConversionId"),
    googleSiteVerification: optionalId("googleSiteVerification"),
    gtmContainerId: optionalId("gtmContainerId"),
    metaCapiEnabled: z.boolean(),
    /** Blank means "keep the stored token" — the form never receives it. */
    metaCapiToken: capiTokenSchema,
    /** Explicit opt-out, since blank cannot mean "clear it". */
    metaCapiTokenCleared: z.boolean(),
    metaDomainVerification: optionalId("metaDomainVerification"),
    metaPixelId: optionalId("metaPixelId"),
    tiktokPixelId: optionalId("tiktokPixelId")
  })
  .superRefine((value, ctx) => {
    if (value.metaCapiEnabled && !value.metaPixelId) {
      ctx.addIssue({
        code: "custom",
        message: "The Conversions API needs a Meta Pixel ID — events are sent against that pixel.",
        path: ["metaPixelId"]
      });
    }
  });

/** Raw form values, before the schema trims/extracts/validates them. */
export type MarketingSettingsFormInput = z.input<typeof marketingSettingsSchema>;
export type MarketingSettingsInput = z.infer<typeof marketingSettingsSchema>;

/** What the settings page is allowed to see: IDs plus a hint, never the token. */
export type MarketingSettingsView = {
  customBodyCode: string;
  customEnabled: boolean;
  customFooterCode: string;
  customHeaderCode: string;
  ga4MeasurementId: string;
  googleAdsConversionId: string;
  googleSiteVerification: string;
  gtmContainerId: string;
  hasCapiToken: boolean;
  metaCapiEnabled: boolean;
  metaCapiTokenHint: string | null;
  metaDomainVerification: string;
  metaPixelId: string;
  tiktokPixelId: string;
};
