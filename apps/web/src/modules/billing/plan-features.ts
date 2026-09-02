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
  "ai_copilot",
  "ai_product_content",
  "ai_shopping_agent",
  "api_access",
  "audiences",
  "blocked_ips",
  "bundles",
  "campaigns",
  "courier_api",
  "coupons",
  "custom_domain",
  "custom_tracking",
  "email_automation",
  "exchanges",
  "expenses",
  "facebook_automation",
  "fake_orders",
  "footer_branding",
  "fraud_check",
  "google_ads_tracking",
  "google_analytics",
  "gtm_tracking",
  "incomplete_orders",
  "inventory",
  "marketing_analytics",
  "marketing_automation",
  "marketing_templates",
  "meta_pixel",
  "notification_bar",
  "order_bump",
  "order_tracking",
  "order_verification",
  "preorders",
  "purchases",
  "refunds",
  "returns",
  "sales",
  "sales_notifications",
  "search_discovery",
  "server_side_tracking",
  "sms_automation",
  "sms_notifications",
  "suppliers",
  "team",
  "tiktok_tracking",
  "upsell_cross_sell",
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
  /**
   * Every StoreIM AI surface the platform pays for: the Store Copilot, the
   * Product Content Studio and the storefront Shopping Agent, all running on the
   * platform engine.
   *
   * A merchant who brings their own Gemini or OpenAI key is still not gated —
   * they are paying the model bill themselves, and `hasOwnAiProvider` is checked
   * beside this key everywhere it is enforced. This entitlement is what the
   * platform charges for, which is exactly what makes it a plan feature.
   */
  /**
   * The three StoreIM AI surfaces are sold separately, because they are not the
   * same purchase: the Copilot and the content studio are tools the merchant
   * points at their own shop, while the Shopping Agent is a public assistant
   * answering their customers.
   *
   * All three keep the rule that a store also qualifies through its *own*
   * Gemini or OpenAI credential — the merchant pays that bill, so no plan may
   * stand between them and a key they are funding. The plan grant is the "or",
   * never an "and"; see the `ownKey || planGrants` reads in
   * store-copilot.service.ts, product-content.service.ts and
   * shopping-agent.service.ts.
   */
  ai_copilot: {
    description: "Ask your store questions in plain language and act on the answers.",
    label: "AI Store Copilot",
    status: "available"
  },
  ai_product_content: {
    description: "Generate product titles, descriptions and SEO copy from your catalogue.",
    label: "AI Product Content",
    status: "available"
  },
  ai_shopping_agent: {
    description: "A chat assistant on the storefront that searches, recommends, and takes orders.",
    label: "AI Shopping Agent",
    status: "available"
  },
  api_access: {
    description: "Mint API keys that let external integrations read this store programmatically.",
    label: "Integrations",
    status: "available"
  },
  /**
   * Blocking an address is the destructive half of fake-order triage — a shared
   * mobile-network IP can be thousands of real buyers — so it sits a tier above
   * the read-only risk signals rather than beside them.
   */
  audiences: {
    description: "Saved customer segments, built from rules and reused across campaigns.",
    label: "Audiences",
    status: "available"
  },
  blocked_ips: {
    description: "Block an IP address from placing orders, permanently or for a set window.",
    label: "Blocked IPs",
    status: "available"
  },
  bundles: {
    description: "Multi-product bundles priced as one offer, on the storefront and in the cart.",
    label: "Bundles",
    status: "available"
  },
  /**
   * The campaign workspace — drafting, audiences, recipients, scheduling. Sending
   * on a given channel is a separate, dearer entitlement (`sms_automation`,
   * `email_automation`, `whatsapp_automation`), so a Growth store can build and
   * plan a campaign while automated delivery stays a Pro capability.
   */
  campaigns: {
    description: "Build, schedule, and track marketing campaigns against a saved audience.",
    label: "Campaigns",
    status: "available"
  },
  courier_api: {
    description: "Courier provider integrations and automated consignments.",
    label: "Courier API",
    status: "available"
  },
  /**
   * Display/entitlement metadata only. Enforcement for custom domains predates
   * this registry and still lives on the `Plan.customDomainEnabled` column via
   * `canUseCustomDomain` — keep the two in step when changing which tier gets it.
   */
  coupons: {
    description: "Discount codes with usage limits, date windows, and per-customer caps.",
    label: "Coupons",
    status: "available"
  },
  custom_domain: {
    description: "Connect your own domain to the storefront.",
    label: "Custom Domain",
    status: "available"
  },
  /**
   * Raw markup the seller pastes in themselves — the escape hatch for any
   * platform without a page of its own. A tier above the by-ID integrations
   * because arbitrary script injection is the one tracking setting that can
   * break the storefront, and because it is what people reach for to add the
   * platforms Growth is otherwise buying.
   */
  custom_tracking: {
    description: "Your own header, body, and footer markup injected into the storefront.",
    label: "Custom Tracking",
    status: "available"
  },
  email_automation: {
    description: "Automated email campaigns and lifecycle flows.",
    label: "Email Automation",
    status: "planned"
  },
  exchanges: {
    description:
      "Swap requests where goods come back and a replacement goes out, settled against stock.",
    label: "Exchanges",
    status: "available"
  },
  expenses: {
    description: "Business expense tracking and expense categories.",
    label: "Expenses",
    status: "available"
  },
  facebook_automation: {
    description: "Facebook and Messenger conversation automation.",
    label: "Facebook Automation",
    status: "planned"
  },
  fake_orders: {
    description: "Fake order detection, customer blocking, and order triage.",
    label: "Fake Order Detection",
    status: "available"
  },
  /**
   * Editing the storefront footer's copyright line.
   *
   * Granted from Starter up, which is to say every paid plan. The Free tier is
   * the platform's shop window — a free year on a `*.storeim.com` subdomain —
   * and the credit in the footer is what it is traded for, so it is not a
   * setting there rather than a setting that resets. `StorefrontFooter` serves
   * the default to an unentitled store however the column was filled in.
   */
  footer_branding: {
    description: "Customize the storefront footer copyright line, including the StoreIM credit.",
    label: "Footer Branding",
    status: "available"
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
  google_analytics: {
    description: "GA4 measurement ID and Google site verification on the storefront.",
    label: "Google Analytics",
    status: "available"
  },
  gtm_tracking: {
    description: "Google Tag Manager container, for managing tags without a deploy.",
    label: "Google Tag Manager",
    status: "available"
  },
  incomplete_orders: {
    description:
      "Checkouts that were filled in but never became orders, with the outreach actions to win them back.",
    label: "Incomplete Orders",
    status: "available"
  },
  inventory: {
    description: "Stock adjustments and inventory movement history.",
    label: "Inventory",
    status: "available"
  },
  marketing_analytics: {
    description: "Marketing performance reporting across campaigns and channels.",
    label: "Marketing Analytics",
    status: "available"
  },
  marketing_automation: {
    description: "Cross-channel campaign automation and journeys.",
    label: "Marketing Automation",
    status: "planned"
  },
  marketing_templates: {
    description: "Reusable SMS and email message templates for campaigns.",
    label: "Templates",
    status: "available"
  },
  meta_pixel: {
    description: "Meta (Facebook and Instagram) pixel and domain verification.",
    label: "Meta Pixel",
    status: "available"
  },
  /**
   * The storefront's one announcement, with a deadline that is a real moment
   * rather than a per-visitor timer. The entitlement buys *publishing* it;
   * switching the bar off is ungated, so a lapsed store can always take down
   * something running on its own storefront.
   */
  notification_bar: {
    description:
      "A floating announcement bar across your storefront, with a countdown and a button.",
    label: "Notification Bar",
    status: "available"
  },
  order_bump: {
    description: "A one-click add-on offer shown to the customer during checkout.",
    label: "Order Bump",
    status: "available"
  },
  order_tracking: {
    description:
      "Track parcels by tracking code, with delivery status auto-synced from the courier's webhook.",
    label: "Order Tracking",
    status: "available"
  },
  order_verification: {
    description: "Courier verification queue for orders before dispatch.",
    label: "Verification Queue",
    status: "available"
  },
  preorders: {
    description:
      "Sell stock that has not arrived yet, and work the backlog from a dashboard until it lands.",
    label: "Pre-orders",
    status: "available"
  },
  purchases: {
    description: "Purchase orders and supplier restocking.",
    label: "Purchases",
    status: "available"
  },
  refunds: {
    description:
      "Money-back requests with nothing to collect, recorded against the original order.",
    label: "Refunds",
    status: "available"
  },
  returns: {
    description: "Return requests from approval through to received goods, refund, and restock.",
    label: "Returns",
    status: "available"
  },
  sales: {
    description: "Manual sales entry and counter-sale records.",
    label: "Sales",
    status: "available"
  },
  /**
   * Social proof drawn from the store's own orders, never from anything a
   * seller could type in. The entitlement buys *publishing* it; switching the
   * widget off is ungated, so a lapsed store can always stop something that is
   * running on its storefront.
   */
  sales_notifications: {
    description: "Show recent real purchases to shoppers in the corner of your storefront.",
    label: "Sales Notifications",
    status: "available"
  },
  search_discovery: {
    description: "Tune storefront search: synonym groups, pinned results, and query redirects.",
    label: "Search & Discovery",
    status: "available"
  },
  server_side_tracking: {
    description:
      "Purchases sent to GA4 and Meta from our server, so sales are still counted when a browser blocks the pixel.",
    label: "Server-Side Tracking",
    status: "available"
  },
  sms_automation: {
    description: "Automated transactional and campaign SMS.",
    label: "SMS Automation",
    status: "planned"
  },
  /**
   * The store's own transactional SMS — which events text a customer, and the
   * sender it goes out as. Distinct from `sms_automation`, which is campaign
   * sending and sits on Pro; how many messages either may send is the plan's
   * `smsLimit` column, not this key.
   */
  sms_notifications: {
    description: "Choose which order events text your customers, and the sender they come from.",
    label: "SMS",
    status: "available"
  },
  suppliers: {
    description: "Supplier records and purchasing contacts.",
    label: "Suppliers",
    status: "available"
  },
  /**
   * Inviting teammates and managing their roles. How many seats the store gets
   * is the plan's `staffLimit` column — a separate question this key does not
   * answer, and does not replace.
   */
  team: {
    description: "Invite teammates, set their roles, and manage access to the store.",
    label: "Team",
    status: "available"
  },
  tiktok_tracking: {
    description: "TikTok pixel and conversion tracking on the storefront.",
    label: "TikTok Pixel",
    status: "available"
  },
  upsell_cross_sell: {
    description:
      "Reporting on how paired products perform — what gets added alongside what, and what it earns.",
    label: "Upsell & Cross-sell",
    status: "available"
  },
  whatsapp_automation: {
    description: "WhatsApp messaging automation.",
    label: "WhatsApp Automation",
    status: "planned"
  }
};

/**
 * What a gated server action hands back when the plan refused it. Returned
 * rather than thrown so the UI can tell "your plan does not include this" apart
 * from a genuine failure and open the upgrade dialog.
 */
export type GatedResult = {
  lockedFeature?: PlanFeatureKey | undefined;
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
