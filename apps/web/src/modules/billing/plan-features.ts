/**
 * Central feature-key registry.
 *
 * Every gated capability is named exactly once, here. Gates take a
 * `PlanFeatureKey` rather than a string, so a typo is a compile error instead of
 * a silently-denied feature, and the set of things a plan can grant is
 * enumerable for future admin/billing UI.
 *
 * Entitlement lives in the `plan_features` table (see `PlanFeature` in
 * schema.prisma) and is granted per plan by `PLAN_CATALOG`. Adding a feature is
 * therefore: add a key here, list it on the plans that get it, re-run
 * `npm run db:backfill-plans`. No schema migration, no new Plan column.
 *
 * `status` is documentation, not a gate — it records whether the underlying
 * product capability actually ships today. `hasPlanFeature` deliberately ignores
 * it: entitlement and implementation are separate questions, and conflating them
 * would make a plan silently stop granting a feature the day someone edits this
 * table. Use it to avoid advertising `planned` features as working.
 */

export const PLAN_FEATURE_KEYS = [
  "abandoned_cart",
  "advanced_analytics",
  "advanced_attribution",
  "affiliate_tracking",
  "api_access",
  "courier_api",
  "email_automation",
  "facebook_automation",
  "fraud_check",
  "google_ads_tracking",
  "marketing_analytics",
  "marketing_automation",
  "pixel_tracking",
  "sms_automation",
  "tiktok_tracking",
  "whatsapp_automation"
] as const;

export type PlanFeatureKey = (typeof PLAN_FEATURE_KEYS)[number];

/** Whether the product capability behind a key actually ships today. */
export type PlanFeatureStatus = "available" | "planned";

export type PlanFeatureDefinition = {
  description: string;
  label: string;
  status: PlanFeatureStatus;
};

export const PLAN_FEATURE_REGISTRY: Record<PlanFeatureKey, PlanFeatureDefinition> = {
  abandoned_cart: {
    description: "Abandoned cart detection, dashboard, and recovery actions.",
    label: "Abandoned Cart Recovery",
    status: "available"
  },
  advanced_analytics: {
    description: "Deeper analytics and the advanced report set.",
    label: "Advanced Analytics",
    status: "available"
  },
  advanced_attribution: {
    description: "Multi-touch attribution across marketing channels.",
    label: "Advanced Attribution",
    status: "planned"
  },
  affiliate_tracking: {
    description: "Affiliate partners, referral links, and payouts.",
    label: "Affiliate Tracking",
    status: "planned"
  },
  api_access: {
    description: "Programmatic store access for external integrations.",
    label: "API Access",
    status: "planned"
  },
  courier_api: {
    description: "Courier provider integrations and automated consignments.",
    label: "Courier API",
    status: "available"
  },
  email_automation: {
    description: "Automated email campaigns and lifecycle flows.",
    label: "Email Automation",
    status: "planned"
  },
  facebook_automation: {
    description: "Facebook and Messenger conversation automation.",
    label: "Facebook Automation",
    status: "planned"
  },
  fraud_check: {
    description: "Courier-backed delivery risk and fraud signals.",
    label: "Fraud Check",
    status: "available"
  },
  google_ads_tracking: {
    description: "Google Ads conversion tracking.",
    label: "Google Ads Tracking",
    status: "available"
  },
  marketing_analytics: {
    description: "Marketing performance reporting and GA4 measurement.",
    label: "Marketing Analytics",
    status: "available"
  },
  marketing_automation: {
    description: "Cross-channel campaign automation and journeys.",
    label: "Marketing Automation",
    status: "planned"
  },
  pixel_tracking: {
    description: "Meta, TikTok, and GA4 pixel tracking on the storefront.",
    label: "Pixel Tracking",
    status: "available"
  },
  sms_automation: {
    description: "Automated transactional and campaign SMS.",
    label: "SMS Automation",
    status: "planned"
  },
  tiktok_tracking: {
    description: "TikTok pixel and conversion tracking.",
    label: "TikTok Tracking",
    status: "available"
  },
  whatsapp_automation: {
    description: "WhatsApp messaging automation.",
    label: "WhatsApp Automation",
    status: "planned"
  }
};

const PLAN_FEATURE_KEY_SET: ReadonlySet<string> = new Set(PLAN_FEATURE_KEYS);

/**
 * Narrows a raw string — a `plan_features.feature_key` value, say — to a known
 * key. Rows written by an older or newer deploy are simply not recognised, which
 * keeps the fail-closed contract intact.
 */
export function isPlanFeatureKey(value: string): value is PlanFeatureKey {
  return PLAN_FEATURE_KEY_SET.has(value);
}
