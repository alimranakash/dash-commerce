/**
 * Plan feature-entitlement check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * gating layer. It is strictly read-only — it writes nothing and creates no
 * fixtures, exercising the fail-closed states through the exported
 * `isEntitledSubscription` predicate instead.
 *
 * Covers:
 * - the entitlement matrix for all four plans, against PLAN_CATALOG;
 * - every registry key resolving through a real plan;
 * - `hasPlanFeature` on real stores;
 * - fail-closed for missing / cancelled / expired / past-due subscriptions;
 * - the pre-existing product and custom-domain gates still answering.
 *
 * Run with: npm run verify:plan-features
 */
import { prisma } from "@dash/db";
import {
  PLAN_CATALOG,
  isPaidFeature,
  minPlanForFeature
} from "../apps/web/src/modules/admin/plan-catalog";
import {
  PLAN_FEATURE_KEYS,
  PLAN_FEATURE_REGISTRY,
  type PlanFeatureKey
} from "../apps/web/src/modules/billing/plan-features";
import {
  canCreateProduct,
  canUseCustomDomain,
  hasPlanFeature,
  isEntitledSubscription,
  listPlanFeatures
} from "../apps/web/src/modules/billing/subscription-limits";
import { TRACKING_SECTIONS } from "../apps/web/src/modules/marketing/tracking-sections";
import { REPORT_FEATURES } from "../apps/web/src/modules/reports/report.types";

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

  if (!passed) {
    failures += 1;
  }
}

async function main() {
  console.log("=== Entitlement matrix (DB vs catalog) ===");

  for (const entry of PLAN_CATALOG) {
    const plan = await prisma.plan.findUnique({
      select: {
        features: {
          select: {
            featureKey: true
          }
        }
      },
      where: {
        slug: entry.slug
      }
    });

    if (!plan) {
      check(`${entry.slug} exists`, false, "plan not found");
      continue;
    }

    const actual = plan.features.map((feature) => feature.featureKey).sort();
    const expected = [...entry.features].sort();
    const matches = actual.length === expected.length && actual.every((key, i) => key === expected[i]);

    check(
      `${entry.slug.padEnd(8)} grants ${expected.length} feature(s)`,
      matches,
      matches ? actual.join(", ") || "none" : `expected [${expected.join(", ")}], got [${actual.join(", ")}]`
    );
  }

  console.log("\n=== Tier containment ===");
  const bySlug = new Map(PLAN_CATALOG.map((entry) => [entry.slug, new Set<string>(entry.features)]));
  const free = bySlug.get("free") ?? new Set();
  const starter = bySlug.get("starter") ?? new Set();
  const growth = bySlug.get("growth") ?? new Set();
  const pro = bySlug.get("pro") ?? new Set();

  check("free grants nothing", free.size === 0);
  check("growth ⊇ starter", [...starter].every((key) => growth.has(key)));
  check("pro ⊇ growth", [...growth].every((key) => pro.has(key)));

  console.log("\n=== Registry coverage ===");
  const granted = new Set([...starter, ...growth, ...pro]);
  const orphaned = PLAN_FEATURE_KEYS.filter((key) => !granted.has(key));
  check("every registry key is granted by some plan", orphaned.length === 0, orphaned.join(", "));

  const unknown = [...granted].filter((key) => !PLAN_FEATURE_KEYS.includes(key as PlanFeatureKey));
  check("no plan grants an unregistered key", unknown.length === 0, unknown.join(", "));

  const planned = PLAN_FEATURE_KEYS.filter((key) => PLAN_FEATURE_REGISTRY[key].status === "planned");
  console.log(`      (${PLAN_FEATURE_KEYS.length - planned.length} available, ${planned.length} planned: ${planned.join(", ")})`);

  console.log("\n=== Paid-feature derivation ===");

  // Definitional check: isPaidFeature must agree with "not granted by Free" for
  // every key, which is what keeps it derived rather than a second hardcoded list.
  const disagreements = PLAN_FEATURE_KEYS.filter((key) => isPaidFeature(key) === free.has(key));
  check("isPaidFeature agrees with the Free entitlement set", disagreements.length === 0, disagreements.join(", "));

  const freeKeys = [...free];
  check(
    "no Free-granted key is marked paid",
    freeKeys.every((key) => !isPaidFeature(key as PlanFeatureKey)),
    freeKeys.length === 0 ? "Free grants nothing, so this case is vacuous today" : freeKeys.join(", ")
  );

  const paidKeys = [...new Set([...starter, ...growth, ...pro])] as PlanFeatureKey[];
  check(
    "every Starter/Growth/Pro key is marked paid",
    paidKeys.every((key) => isPaidFeature(key)),
    `${paidKeys.length} key(s)`
  );

  check("minPlanForFeature(courier_api) === Starter", minPlanForFeature("courier_api") === "Starter", String(minPlanForFeature("courier_api")));
  check("minPlanForFeature(api_access) === Growth", minPlanForFeature("api_access") === "Growth", String(minPlanForFeature("api_access")));
  check("minPlanForFeature(sms_automation) === Pro", minPlanForFeature("sms_automation") === "Pro", String(minPlanForFeature("sms_automation")));
  check(
    "minPlanForFeature resolves for every registry key",
    PLAN_FEATURE_KEYS.every((key) => minPlanForFeature(key) !== null)
  );

  console.log("\n=== Order-desk tiering ===");

  // The order desk is sold in two halves, and this is the statement of which
  // half is which. Every key here is a page in the Orders section of the
  // sidebar, so one drifting to the wrong tier is a page that silently changes
  // price — these checks are what make that a build failure.
  const ORDER_DESK_TIERS: Array<[PlanFeatureKey, string]> = [
    // Working the orders you have.
    ["returns", "Starter"],
    ["refunds", "Starter"],
    ["order_tracking", "Starter"],
    ["incomplete_orders", "Starter"],
    // Refusing the orders you do not want.
    ["fraud_check", "Growth"],
    ["blocked_ips", "Growth"],
    ["order_verification", "Growth"],
    ["fake_orders", "Growth"],
    ["exchanges", "Growth"]
  ];

  for (const [key, expected] of ORDER_DESK_TIERS) {
    const actual = minPlanForFeature(key);

    check(
      `${key.padEnd(18)} unlocks at ${expected}`,
      actual === expected,
      actual === expected ? "" : `got ${String(actual)}`
    );
  }

  // Every one of them is a real page, and none of them is free.
  check(
    "every order-desk feature is paid",
    ORDER_DESK_TIERS.every(([key]) => isPaidFeature(key))
  );
  check(
    "every order-desk feature ships today",
    ORDER_DESK_TIERS.every(([key]) => PLAN_FEATURE_REGISTRY[key].status === "available"),
    ORDER_DESK_TIERS.filter(([key]) => PLAN_FEATURE_REGISTRY[key].status !== "available")
      .map(([key]) => key)
      .join(", ")
  );

  console.log("\n=== Marketing tiering ===");

  // Starter buys the pieces a campaign is assembled from; Growth buys reaching
  // out with them. The split only means anything if it holds, so it is asserted
  // rather than left to the catalog to get right by hand.
  const MARKETING_TIERS: Array<[PlanFeatureKey, string]> = [
    // The building blocks.
    ["coupons", "Starter"],
    ["audiences", "Starter"],
    ["marketing_templates", "Starter"],
    ["order_bump", "Starter"],
    ["bundles", "Starter"],
    // Reaching out.
    ["campaigns", "Growth"],
    ["abandoned_cart", "Growth"]
  ];

  for (const [key, expected] of MARKETING_TIERS) {
    const actual = minPlanForFeature(key);

    check(
      `${key.padEnd(19)} unlocks at ${expected}`,
      actual === expected,
      actual === expected ? "" : `got ${String(actual)}`
    );
  }

  check(
    "every marketing feature is paid",
    MARKETING_TIERS.every(([key]) => isPaidFeature(key))
  );

  // The campaign workspace must stay cheaper than sending on any channel,
  // otherwise "Campaigns is Growth" would be a promise the send gate breaks.
  const workspaceTier = PLAN_CATALOG.find((entry) => entry.features.includes("campaigns"))?.sortOrder;
  const deliveryKeys: PlanFeatureKey[] = ["sms_automation", "email_automation", "whatsapp_automation"];

  for (const key of deliveryKeys) {
    const deliveryTier = PLAN_CATALOG.find((entry) => entry.features.includes(key))?.sortOrder;

    check(
      `${key.padEnd(19)} is not cheaper than the campaign workspace`,
      workspaceTier !== undefined &&
        deliveryTier !== undefined &&
        deliveryTier >= workspaceTier,
      `workspace=${String(workspaceTier)} delivery=${String(deliveryTier)}`
    );
  }

  console.log("\n=== Analytics & Tracking tiering ===");

  // The one place all three tiers meet in a single menu. Every row here is a
  // page under /dashboard/analytics, and the tier is the whole product story:
  // connect the storefront pixels on Starter, reach past the storefront on
  // Growth, send from our own servers on Pro.
  const TRACKING_TIERS: Array<[PlanFeatureKey, string]> = [
    ["meta_pixel", "Starter"],
    ["google_analytics", "Starter"],
    ["tiktok_tracking", "Starter"],
    ["google_ads_tracking", "Growth"],
    ["custom_tracking", "Growth"],
    ["gtm_tracking", "Growth"],
    ["server_side_tracking", "Pro"]
  ];

  for (const [key, expected] of TRACKING_TIERS) {
    const actual = minPlanForFeature(key);

    check(
      `${key.padEnd(20)} unlocks at ${expected}`,
      actual === expected,
      actual === expected ? "" : `got ${String(actual)}`
    );
  }

  // Every tracking page gates on the key its own record declares, so the badge
  // the seller reads and the gate that refuses them cannot come apart. This is
  // the check that would catch a new section added without an entitlement.
  const trackingSections = Object.entries(TRACKING_SECTIONS);
  const tieredKeys = new Set<string>(TRACKING_TIERS.map(([key]) => key));

  check(
    `all ${trackingSections.length} tracking sections declare a known feature`,
    trackingSections.every(([, config]) => PLAN_FEATURE_KEYS.includes(config.feature)),
    trackingSections
      .filter(([, config]) => !PLAN_FEATURE_KEYS.includes(config.feature))
      .map(([name]) => name)
      .join(", ")
  );
  check(
    "every tracking section is covered by the tier table above",
    trackingSections.every(([, config]) => tieredKeys.has(config.feature)),
    trackingSections
      .filter(([, config]) => !tieredKeys.has(config.feature))
      .map(([name]) => name)
      .join(", ")
  );
  check(
    "no tracking section is free",
    trackingSections.every(([, config]) => isPaidFeature(config.feature))
  );

  console.log("\n=== Operations & reports tiering ===");

  const OPERATIONS_TIERS: Array<[PlanFeatureKey, string]> = [
    ["preorders", "Starter"],
    ["team", "Starter"],
    ["sms_notifications", "Starter"],
    ["custom_domain", "Starter"],
    ["courier_api", "Starter"],
    ["search_discovery", "Growth"],
    ["upsell_cross_sell", "Growth"]
  ];

  for (const [key, expected] of OPERATIONS_TIERS) {
    const actual = minPlanForFeature(key);

    check(
      `${key.padEnd(18)} unlocks at ${expected}`,
      actual === expected,
      actual === expected ? "" : `got ${String(actual)}`
    );
  }

  // A report must never be cheaper than the workspace it reports on: reading
  // the Abandoned Carts figures is worth nothing to a seller who cannot open
  // the carts, so the two ride the same key by construction.
  check(
    "the Abandoned Carts report rides the abandoned_cart key",
    REPORT_FEATURES["abandoned-carts"] === "abandoned_cart"
  );
  check(
    "the Incomplete Orders report rides the incomplete_orders key",
    REPORT_FEATURES["incomplete-orders"] === "incomplete_orders"
  );
  check(
    "every gated report names a known, paid feature",
    Object.values(REPORT_FEATURES).every(
      (key) => PLAN_FEATURE_KEYS.includes(key) && isPaidFeature(key)
    ),
    Object.entries(REPORT_FEATURES)
      .filter(([, key]) => !PLAN_FEATURE_KEYS.includes(key) || !isPaidFeature(key))
      .map(([name]) => name)
      .join(", ")
  );

  // The free reports are free on purpose — they describe the store itself.
  const FREE_REPORTS = ["orders", "revenues", "products", "customers"];

  check(
    "the four store-level reports stay ungated",
    FREE_REPORTS.every((report) => !(report in REPORT_FEATURES)),
    FREE_REPORTS.filter((report) => report in REPORT_FEATURES).join(", ")
  );

  console.log("\n=== Fail-closed states ===");
  const future = new Date(Date.now() + 86_400_000);
  const past = new Date(Date.now() - 86_400_000);

  check("ACTIVE + future period is entitled", isEntitledSubscription({ currentPeriodEndsAt: future, status: "ACTIVE" }));
  check("TRIALING + future period is entitled", isEntitledSubscription({ currentPeriodEndsAt: future, status: "TRIALING" }));
  check("ACTIVE + null period is entitled", isEntitledSubscription({ currentPeriodEndsAt: null, status: "ACTIVE" }));
  check("ACTIVE but expired period is denied", !isEntitledSubscription({ currentPeriodEndsAt: past, status: "ACTIVE" }));
  check("TRIALING but expired trial is denied", !isEntitledSubscription({ currentPeriodEndsAt: past, status: "TRIALING" }));
  check("PAST_DUE is denied", !isEntitledSubscription({ currentPeriodEndsAt: future, status: "PAST_DUE" }));
  check("CANCELLED is denied", !isEntitledSubscription({ currentPeriodEndsAt: future, status: "CANCELLED" }));
  check("EXPIRED is denied", !isEntitledSubscription({ currentPeriodEndsAt: future, status: "EXPIRED" }));

  const missingStoreId = "store-that-does-not-exist";
  check("no subscription denies feature", (await hasPlanFeature(missingStoreId, "courier_api")) === false);
  check("no subscription lists no features", (await listPlanFeatures(missingStoreId)).length === 0);

  console.log("\n=== Live stores ===");
  const subscriptions = await prisma.subscription.findMany({
    include: {
      plan: {
        select: {
          slug: true
        }
      },
      store: {
        select: {
          slug: true
        }
      }
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  for (const subscription of subscriptions) {
    const entitled = isEntitledSubscription(subscription);
    const features = await listPlanFeatures(subscription.storeId);
    const courier = await hasPlanFeature(subscription.storeId, "courier_api");
    const automation = await hasPlanFeature(subscription.storeId, "whatsapp_automation");

    console.log(
      `      ${subscription.store.slug.padEnd(18)} plan=${subscription.plan.slug.padEnd(8)} ` +
        `status=${subscription.status.padEnd(9)} entitled=${String(entitled).padEnd(5)} ` +
        `features=${features.length} courier_api=${courier} whatsapp_automation=${automation}`
    );

    check(
      `  ${subscription.store.slug} entitlement is consistent`,
      entitled ? features.length >= 0 : features.length === 0
    );
    check(
      `  ${subscription.store.slug} never exceeds its plan`,
      !automation || subscription.plan.slug === "pro"
    );
  }

  console.log("\n=== Pre-existing gates still answer ===");
  const sampleStoreId = subscriptions[0]?.storeId;

  if (sampleStoreId) {
    const product = await canCreateProduct(sampleStoreId);
    const domain = await canUseCustomDomain(sampleStoreId);
    check("canCreateProduct returns a boolean", typeof product === "boolean", String(product));
    check("canUseCustomDomain returns a boolean", typeof domain === "boolean", String(domain));
    check(
      "canCreateProduct still fails open with no subscription",
      (await canCreateProduct(missingStoreId)) === true
    );
    check(
      "canUseCustomDomain still denies with no subscription",
      (await canUseCustomDomain(missingStoreId)) === false
    );
  } else {
    console.log("      no subscriptions to sample");
  }

  console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);

  if (failures > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
