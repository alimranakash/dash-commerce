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
 *   and admin UIs, and the `productLimit <= 0` / `orderLimit <= 0`
 *   short-circuits in `subscription-limits.ts`.
 * - `productLimit` counts the store's whole catalog; `orderLimit` counts orders
 *   placed in the current calendar month, which is how the pricing cards state
 *   it ("N orders / month").
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
  "audiences",
  "bundles",
  "coupons",
  "courier_api",
  "custom_domain",
  "expenses",
  "footer_branding",
  "google_analytics",
  "incomplete_orders",
  "inventory",
  "marketing_analytics",
  "marketing_templates",
  "meta_pixel",
  "order_bump",
  "order_tracking",
  "preorders",
  "purchases",
  "refunds",
  "returns",
  "sales",
  "sms_notifications",
  "suppliers",
  "team",
  "tiktok_tracking"
];

/**
 * Everything Starter has, plus the order-risk suite and outbound marketing.
 *
 * Fraud Check, Fake Orders, the Verification Queue, Blocked IPs and Exchanges
 * sit here rather than on Starter because each one either spends money on a
 * courier lookup or refuses a customer outright, and a seller reaching for them
 * is already running the volume that creates the problem they solve.
 *
 * Campaigns and Abandoned Cart join them because both reach *out* to customers
 * rather than serving the ones already on the site. Starter buys the pieces a
 * campaign is assembled from — Audiences, Templates, Coupons — and Growth buys
 * sending to them. Note this is the campaign *workspace*: automated delivery on
 * a channel stays a Pro entitlement below.
 */
const GROWTH_FEATURES: PlanFeatureKey[] = [
  ...STARTER_FEATURES,
  "abandoned_cart",
  "advanced_analytics",
  "api_access",
  "blocked_ips",
  "campaigns",
  "custom_tracking",
  "exchanges",
  "fake_orders",
  "fraud_check",
  "google_ads_tracking",
  "gtm_tracking",
  "order_verification",
  "search_discovery",
  "upsell_cross_sell"
];

const PRO_FEATURES: PlanFeatureKey[] = [
  ...GROWTH_FEATURES,
  "advanced_attribution",
  "affiliate_tracking",
  "email_automation",
  "facebook_automation",
  "marketing_automation",
  "server_side_tracking",
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

/**
 * How long the free tier stays usable: one full year from the day the store is
 * created. This is the platform's headline offer, so it is defined once here and
 * read by everything that states or enforces it — the marketing page's "365 days
 * free" band, the dashboard countdown, the subscription seeded for a new store,
 * and the lock that stops an expired store from selling.
 *
 * It is a *trial* rather than a permanently free plan on purpose: the whole
 * point is that the seller is asked to upgrade when the year is up.
 */
export const FREE_PLAN_TRIAL_DAYS = 365;

/**
 * How many trial days a brand-new store's subscription is stamped with.
 *
 * Normally the plan's own `trialDays` column. The free tier is the exception: a
 * database seeded before the free year — `Plan.trialDays` defaults to `0` — or a
 * plan row edited down to zero would otherwise hand a new store a trial that
 * ended the instant it was created, so the seller's first visit to the dashboard
 * is the "your free year has ended" lock. The offer is stated to the world from
 * `FREE_PLAN_TRIAL_DAYS`, so that is what a non-positive column falls back to.
 *
 * Only a non-positive value is overridden. An admin who deliberately shortens
 * the free trial keeps their edit.
 */
export function newStoreTrialDays(plan: { slug: string; trialDays: number }) {
  if (plan.slug === DEFAULT_PLAN_SLUG && plan.trialDays <= 0) {
    return FREE_PLAN_TRIAL_DAYS;
  }

  return plan.trialDays;
}

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    aiEnabled: false,
    currency: "BDT",
    customDomainEnabled: false,
    customerLimit: 100,
    description: "Everything you need to sell online, free for a full year.",
    features: [],
    isActive: true,
    isFeatured: false,
    name: "Free",
    orderLimit: 75,
    posEnabled: false,
    priceMonthly: "0.00",
    priceYearly: "0.00",
    productLimit: 20,
    slug: "free",
    sortOrder: 0,
    staffLimit: 1,
    storeLimit: 1,
    trialDays: FREE_PLAN_TRIAL_DAYS
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
