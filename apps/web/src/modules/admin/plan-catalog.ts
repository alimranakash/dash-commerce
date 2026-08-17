/**
 * Canonical pricing-plan catalog.
 *
 * This is the single definition of the platform's plans. Two callers read it:
 *
 * - `ensureDefaultPlans()` seeds it into an *empty* `plans` table (new installs).
 * - `scripts/backfill-plans.ts` upserts it by slug into a populated one.
 *
 * Keeping both on this array is what stops a fresh install and a migrated
 * install from disagreeing about what "Growth" costs.
 *
 * Conventions inherited from the existing data, not invented here:
 * - `priceYearly` is `priceMonthly * 10` (two months free).
 * - A limit of `0` means unlimited — see `limitText`/`limitLabel` in the billing
 *   and admin UIs, and the `productLimit <= 0` short-circuit in
 *   `subscription-limits.ts`.
 *
 * `isActive` and `isFeatured` are operational flags an admin owns at runtime, so
 * they are applied on create only and deliberately left alone on update.
 */

import type { PlanFeatureKey } from "../billing/plan-features";

/**
 * Entitlements are composed so that "everything in the plan below, plus…" is
 * literally how they are written. Adding a feature to Starter therefore also
 * grants it to Growth and Pro, which is the intended tier behaviour.
 */
const STARTER_FEATURES: PlanFeatureKey[] = [
  "abandoned_cart",
  "courier_api",
  "fraud_check",
  "marketing_analytics",
  "pixel_tracking"
];

const GROWTH_FEATURES: PlanFeatureKey[] = [
  ...STARTER_FEATURES,
  "advanced_analytics",
  "api_access",
  "google_ads_tracking",
  "tiktok_tracking"
];

const PRO_FEATURES: PlanFeatureKey[] = [
  ...GROWTH_FEATURES,
  "advanced_attribution",
  "affiliate_tracking",
  "email_automation",
  "facebook_automation",
  "marketing_automation",
  "sms_automation",
  "whatsapp_automation"
];

export type PlanCatalogEntry = {
  aiEnabled: boolean;
  currency: string;
  customDomainEnabled: boolean;
  customerLimit: number;
  description: string;
  features: PlanFeatureKey[];
  isActive: boolean;
  isFeatured: boolean;
  name: string;
  orderLimit: number;
  posEnabled: boolean;
  priceMonthly: string;
  priceYearly: string;
  productLimit: number;
  slug: string;
  sortOrder: number;
  staffLimit: number;
  storeLimit: number;
  trialDays: number;
};

/**
 * Slug a brand-new store's subscription is created against. `starter` is kept as
 * a fallback so store creation still works on a database that predates the free
 * tier — the previous default — rather than silently producing no subscription.
 */
export const DEFAULT_PLAN_SLUG = "free";
export const FALLBACK_DEFAULT_PLAN_SLUG = "starter";

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    aiEnabled: false,
    currency: "BDT",
    customDomainEnabled: false,
    customerLimit: 100,
    description: "Core commerce only. Best for validating your first storefront.",
    features: [],
    isActive: true,
    isFeatured: false,
    name: "Free",
    orderLimit: 50,
    posEnabled: false,
    priceMonthly: "0.00",
    priceYearly: "0.00",
    productLimit: 20,
    slug: "free",
    sortOrder: 0,
    staffLimit: 1,
    storeLimit: 1,
    trialDays: 0
  },
  {
    aiEnabled: false,
    currency: "BDT",
    customDomainEnabled: true,
    customerLimit: 1000,
    description: "Custom domain and higher limits for stores finding traction.",
    features: STARTER_FEATURES,
    isActive: true,
    isFeatured: false,
    name: "Starter",
    orderLimit: 500,
    posEnabled: false,
    priceMonthly: "590.00",
    priceYearly: "5900.00",
    productLimit: 200,
    slug: "starter",
    sortOrder: 1,
    staffLimit: 2,
    storeLimit: 1,
    trialDays: 7
  },
  {
    aiEnabled: true,
    currency: "BDT",
    customDomainEnabled: true,
    customerLimit: 5000,
    description: "AI and POS unlocked, with room to scale your catalog.",
    features: GROWTH_FEATURES,
    isActive: true,
    isFeatured: true,
    name: "Growth",
    orderLimit: 2000,
    posEnabled: true,
    priceMonthly: "1190.00",
    priceYearly: "11900.00",
    productLimit: 1000,
    slug: "growth",
    sortOrder: 2,
    staffLimit: 5,
    storeLimit: 1,
    trialDays: 14
  },
  {
    aiEnabled: true,
    currency: "BDT",
    customDomainEnabled: true,
    customerLimit: 0,
    description: "Unlimited products and orders for established operations.",
    features: PRO_FEATURES,
    isActive: true,
    isFeatured: false,
    name: "Pro",
    orderLimit: 0,
    posEnabled: true,
    priceMonthly: "1590.00",
    priceYearly: "15900.00",
    productLimit: 0,
    slug: "pro",
    sortOrder: 3,
    staffLimit: 10,
    storeLimit: 1,
    trialDays: 14
  }
];

/**
 * Pricing, limits, and feature flags — everything the backfill is allowed to
 * overwrite on a plan that already exists. Excludes `isActive`/`isFeatured`.
 */
export function planCatalogUpdateData(entry: PlanCatalogEntry) {
  return {
    aiEnabled: entry.aiEnabled,
    currency: entry.currency,
    customDomainEnabled: entry.customDomainEnabled,
    customerLimit: entry.customerLimit,
    description: entry.description,
    name: entry.name,
    orderLimit: entry.orderLimit,
    posEnabled: entry.posEnabled,
    priceMonthly: entry.priceMonthly,
    priceYearly: entry.priceYearly,
    productLimit: entry.productLimit,
    sortOrder: entry.sortOrder,
    staffLimit: entry.staffLimit,
    storeLimit: entry.storeLimit,
    trialDays: entry.trialDays
  };
}

/**
 * Everything the free tier grants. Derived from the catalog rather than kept as
 * a second list, so a key moved onto Free stops being "paid" automatically.
 */
const FREE_PLAN_FEATURES: ReadonlySet<string> = new Set(
  PLAN_CATALOG.find((entry) => entry.slug === DEFAULT_PLAN_SLUG)?.features ?? []
);

/** A feature is paid when the free tier does not grant it. */
export function isPaidFeature(featureKey: PlanFeatureKey) {
  return !FREE_PLAN_FEATURES.has(featureKey);
}

/**
 * Display name of the cheapest plan granting a feature — "Starter", "Growth",
 * "Pro" — so a badge can say what unlocks it. `null` when no plan grants the key
 * (a registry entry that has not been assigned to a tier yet).
 */
export function minPlanForFeature(featureKey: PlanFeatureKey): string | null {
  return (
    [...PLAN_CATALOG]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .find((entry) => entry.features.includes(featureKey))?.name ?? null
  );
}
