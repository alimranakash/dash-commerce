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
