/**
 * Pricing-plan backfill.
 *
 * `ensureDefaultPlans()` only seeds an *empty* `plans` table, so editing the
 * catalog has no effect on a database that already has plans. This script is the
 * other half: it upserts `PLAN_CATALOG` by slug onto a populated database.
 *
 * It is idempotent and safe to re-run. Specifically it does NOT:
 * - reassign any existing subscription to a different plan;
 * - delete or deactivate plans that are not in the catalog;
 * - overwrite `isActive` / `isFeatured` on a plan that already exists, since
 *   those are operational flags an admin owns at runtime.
 *
 * Run with:   npm run db:backfill-plans
 * Preview:    npm run db:backfill-plans -- --dry-run
 *
 * `.mts` because `@dash/db` is ESM-only and the repo root is not `type: module`.
 */
import { prisma, type Prisma } from "@dash/db";
import {
  PLAN_CATALOG,
  planCatalogUpdateData
} from "../apps/web/src/modules/admin/plan-catalog";
import type { PlanFeatureKey } from "../apps/web/src/modules/billing/plan-features";

type PlanRow = Prisma.PlanGetPayload<Record<string, never>>;
type PlanUpdateData = ReturnType<typeof planCatalogUpdateData>;

const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (dryRun) {
    console.log("DRY RUN — no writes will be made.\n");
  }

  for (const entry of PLAN_CATALOG) {
    const existing = await prisma.plan.findUnique({
      where: {
        slug: entry.slug
      },
      include: {
        _count: {
          select: {
            subscriptions: true
          }
        }
      }
    });

    if (!existing) {
      if (!dryRun) {
        const { features, ...plan } = entry;

        await prisma.plan.create({
          data: {
            ...plan,
            features: {
              create: features.map((featureKey) => ({ featureKey }))
            }
          }
        });
      }

      console.log(
        `created  ${entry.slug.padEnd(8)} ${entry.currency} ${entry.priceMonthly}/mo, ${entry.features.length} feature(s)`
      );
      continue;
    }

    const updates = planCatalogUpdateData(entry);
    const fieldChanges = diffPlan(existing, updates);
    const featureChanges = await syncPlanFeatures(existing.id, entry.features);
    const changes = [...fieldChanges, ...featureChanges];

    if (changes.length === 0) {
      console.log(`ok       ${entry.slug.padEnd(8)} already matches the catalog`);
      continue;
    }

    if (!dryRun && fieldChanges.length > 0) {
      await prisma.plan.update({
        data: updates,
        where: {
          id: existing.id
        }
      });
    }

    console.log(
      `updated  ${entry.slug.padEnd(8)} ${changes.join(", ")}` +
        (existing._count.subscriptions > 0
          ? `  (${existing._count.subscriptions} subscription(s) kept on this plan)`
          : "")
    );
  }

  const untouched = await prisma.plan.findMany({
    where: {
      slug: {
        notIn: PLAN_CATALOG.map((entry) => entry.slug)
      }
    },
    include: {
      _count: {
        select: {
          subscriptions: true
        }
      }
    }
  });

  for (const plan of untouched) {
    console.log(
      `left     ${plan.slug.padEnd(8)} not in the catalog — untouched (${plan._count.subscriptions} subscription(s))`
    );
  }

  console.log("\nDone. No subscription was reassigned.");
}

/**
 * Field-level comparison so a re-run reports "already matches" instead of a
 * meaningless update. Decimal columns come back as Prisma `Decimal`, so both
 * sides are normalised through `Number` before comparing.
 */
/**
 * Brings a plan's `plan_features` rows in line with the catalog. Unlike
 * `isActive`/`isFeatured`, entitlements have no admin UI yet, so the catalog is
 * their only source of truth — extras are removed rather than preserved, which
 * is what makes revoking a feature from a tier possible.
 */
async function syncPlanFeatures(planId: string, featureKeys: PlanFeatureKey[]) {
  const rows = await prisma.planFeature.findMany({
    select: {
      featureKey: true
    },
    where: {
      planId
    }
  });

  const current = new Set(rows.map((row) => row.featureKey));
  const desired = new Set<string>(featureKeys);
  const missing = featureKeys.filter((key) => !current.has(key)).sort();
  const extra = [...current].filter((key) => !desired.has(key)).sort();

  if (!dryRun) {
    if (missing.length > 0) {
      await prisma.planFeature.createMany({
        data: missing.map((featureKey) => ({ featureKey, planId })),
        skipDuplicates: true
      });
    }

    if (extra.length > 0) {
      await prisma.planFeature.deleteMany({
        where: {
          featureKey: {
            in: extra
          },
          planId
        }
      });
    }
  }

  const changes: string[] = [];

  if (missing.length > 0) {
    changes.push(`+features ${missing.join(", ")}`);
  }

  if (extra.length > 0) {
    changes.push(`-features ${extra.join(", ")}`);
  }

  return changes;
}

function diffPlan(existing: PlanRow, updates: PlanUpdateData) {
  const changes: string[] = [];

  for (const key of Object.keys(updates) as Array<keyof PlanUpdateData>) {
    const next = updates[key];
    const current = existing[key];
    const isMoney = key === "priceMonthly" || key === "priceYearly";
    const same = isMoney ? Number(current) === Number(next) : current === next;

    if (!same) {
      changes.push(`${String(key)} ${formatValue(current)} -> ${formatValue(next)}`);
    }
  }

  return changes;
}

function formatValue(value: unknown) {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string" && value.length > 32) {
    return `"${value.slice(0, 29)}..."`;
  }

  return typeof value === "object" ? String(value) : JSON.stringify(value);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
