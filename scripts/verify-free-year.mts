/**
 * Free-year offer check.
 *
 * There is no test runner in this repo, so this is the executable check for the
 * 365-day free tier, mirroring `verify-staff-seats.mts`.
 *
 * It writes, because the behaviour worth proving only exists across real rows:
 * a new store being handed exactly a year, the day count falling, and the lock
 * closing the moment the year is up. It never touches existing data — it builds
 * one throwaway organization with its own store and subscription and deletes it
 * in a `finally`. Deleting the organization cascades to both.
 *
 * Covers:
 * - the free plan carrying a 365-day trial;
 * - a brand-new store's subscription being stamped with the full year;
 * - the countdown reporting whole days, and the progress denominator;
 * - the lock staying open inside the year and closing once it elapses;
 * - `assertStoreUnlocked` — the exact call checkout makes — refusing an order;
 * - a *paid* plan with an elapsed trial staying unlocked, since the lock is the
 *   free year running out and nothing else;
 * - failing open for a subscription with no trial end date at all;
 * - a free plan row carrying `trialDays: 0` — every database seeded before the
 *   free year — still handing a new store the full year rather than a trial that
 *   has already ended, and a store already stamped with one not being locked.
 *
 * Run with: npm run verify:free-year
 */
import { prisma } from "@dash/db";
import { ensureDefaultPlans } from "../apps/web/src/modules/admin/admin-plans.repository";
import { createDefaultSubscriptionRecord } from "../apps/web/src/modules/admin/admin-subscriptions.repository";
import {
  FREE_PLAN_TRIAL_DAYS,
  newStoreTrialDays
} from "../apps/web/src/modules/admin/plan-catalog";
import {
  SubscriptionLockedError,
  assertStoreUnlocked,
  daysUntil,
  getStoreFreeTrialState,
  isStoreLocked
} from "../apps/web/src/modules/billing/free-trial";

const FIXTURE_PREFIX = "free-year-verify";
const DAY_MS = 1000 * 60 * 60 * 24;

let failures = 0;

function check(label: string, passed: boolean, detail = "") {
  console.log(`${passed ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);

  if (!passed) {
    failures += 1;
  }
}

/**
 * Moves the store's trial end date, the way time passing would.
 *
 * `trialStartsAt` moves with it and stays a full year behind: time passing
 * shifts the whole window. A start date left at "today" with an end date in the
 * past would instead be a zero-or-negative trial, which no store reaches by
 * waiting and which the reader deliberately treats as "no trial was granted".
 */
async function setTrialEnd(storeId: string, endsAt: Date | null) {
  await prisma.subscription.update({
    data: {
      currentPeriodEndsAt: endsAt,
      trialEndsAt: endsAt,
      trialStartsAt: endsAt ? new Date(endsAt.getTime() - FREE_PLAN_TRIAL_DAYS * DAY_MS) : null
    },
    where: {
      storeId
    }
  });
}

async function main() {
  console.log("=== Catalog ===");
  await ensureDefaultPlans();

  const [freePlan, starterPlan] = await Promise.all([
    prisma.plan.findUnique({ select: { id: true, trialDays: true }, where: { slug: "free" } }),
    prisma.plan.findUnique({ select: { id: true }, where: { slug: "starter" } })
  ]);

  if (!freePlan || !starterPlan) {
    check("free and starter plans exist", false, "run npm run db:backfill-plans");
    return;
  }

  check(
    `free plan grants ${FREE_PLAN_TRIAL_DAYS} trial days`,
    freePlan.trialDays === FREE_PLAN_TRIAL_DAYS,
    `trialDays=${freePlan.trialDays} (ensureDefaultPlans repairs a zero here)`
  );
  check(
    "a zeroed free plan row still grants the year",
    newStoreTrialDays({ slug: "free", trialDays: 0 }) === FREE_PLAN_TRIAL_DAYS
  );
  check(
    "a deliberately shortened free trial is honoured",
    newStoreTrialDays({ slug: "free", trialDays: 30 }) === 30
  );
  check("daysUntil rounds up and floors at zero", daysUntil(new Date(Date.now() - DAY_MS)) === 0);

  const organization = await prisma.organization.create({
    data: {
      name: "Free Year Check Workspace",
      slug: `${FIXTURE_PREFIX}-${Date.now()}`
    },
    select: { id: true }
  });

  try {
    const store = await prisma.store.create({
      data: {
        name: "Free Year Check Store",
        organizationId: organization.id,
        slug: `${FIXTURE_PREFIX}-store-${Date.now()}`
      },
      select: { id: true }
    });

    console.log("\n=== A brand-new store ===");
    // The same call store onboarding makes, so what is proved here is what a
    // real seller gets rather than a fixture written to look right.
    await prisma.$transaction(async (tx) => {
      await createDefaultSubscriptionRecord(tx, {
        organizationId: organization.id,
        storeId: store.id
      });
    });

    const created = await prisma.subscription.findUniqueOrThrow({
      select: { plan: { select: { slug: true } }, status: true, trialEndsAt: true },
      where: { storeId: store.id }
    });

    check("starts on the free plan", created.plan.slug === "free", created.plan.slug);
    check("starts TRIALING", created.status === "TRIALING", created.status);

    const grantedDays = created.trialEndsAt
      ? Math.round((created.trialEndsAt.getTime() - Date.now()) / DAY_MS)
      : 0;

    check(
      `is given ${FREE_PLAN_TRIAL_DAYS} days`,
      grantedDays === FREE_PLAN_TRIAL_DAYS,
      `${grantedDays} days`
    );

    const fresh = await getStoreFreeTrialState(store.id);

    check(
      "countdown reports the full year",
      fresh?.daysRemaining === FREE_PLAN_TRIAL_DAYS,
      `${fresh?.daysRemaining}`
    );
    check("countdown knows the trial length", fresh?.totalDays === FREE_PLAN_TRIAL_DAYS, `${fresh?.totalDays}`);
    check("not expired", fresh?.isExpired === false);
    check("store is unlocked", (await isStoreLocked(store.id)) === false);

    console.log("\n=== Ten days from the end ===");
    await setTrialEnd(store.id, new Date(Date.now() + 10 * DAY_MS));

    const nearly = await getStoreFreeTrialState(store.id);

    check("countdown reports 10 days", nearly?.daysRemaining === 10, `${nearly?.daysRemaining}`);
    check("still unlocked on the last days", (await isStoreLocked(store.id)) === false);

    console.log("\n=== The year is up ===");
    await setTrialEnd(store.id, new Date(Date.now() - DAY_MS));

    const over = await getStoreFreeTrialState(store.id);

    check("countdown floors at zero", over?.daysRemaining === 0, `${over?.daysRemaining}`);
    check("reported as expired", over?.isExpired === true);
    check("store is locked", (await isStoreLocked(store.id)) === true);

    try {
      await assertStoreUnlocked(store.id);
      check("checkout is refused", false, "no error thrown");
    } catch (error) {
      check(
        "checkout is refused",
        error instanceof SubscriptionLockedError,
        (error as Error).message
      );
    }

    console.log("\n=== Scope: a paid plan is not touched ===");
    await prisma.subscription.update({
      data: { planId: starterPlan.id },
      where: { storeId: store.id }
    });

    check("no countdown on a paid plan", (await getStoreFreeTrialState(store.id)) === null);
    check(
      "an elapsed paid trial does not lock",
      (await isStoreLocked(store.id)) === false,
      "paid lapses stay with the manual payment flow"
    );

    console.log("\n=== Scope: fails open without a trial date ===");
    await prisma.subscription.update({
      data: { planId: freePlan.id },
      where: { storeId: store.id }
    });
    await setTrialEnd(store.id, null);

    check("no countdown without a date", (await getStoreFreeTrialState(store.id)) === null);
    check("and no lock", (await isStoreLocked(store.id)) === false);

    console.log("\n=== Scope: a trial that ended when it started ===");
    // Exactly what a store created against a `trialDays: 0` free plan row was
    // stamped with. It has to read as "no trial was granted" rather than as a
    // year that elapsed, or the seller is locked out on their first visit.
    const stampedAt = new Date(Date.now() - 30 * DAY_MS);

    await prisma.subscription.update({
      data: {
        currentPeriodEndsAt: stampedAt,
        trialEndsAt: stampedAt,
        trialStartsAt: stampedAt
      },
      where: { storeId: store.id }
    });

    check("no countdown on a zero-length trial", (await getStoreFreeTrialState(store.id)) === null);
    check("and no lock", (await isStoreLocked(store.id)) === false);
  } finally {
    // Cascades to the store and its subscription.
    await prisma.organization.delete({ where: { id: organization.id } });
    console.log("\nFixtures removed.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    failures += 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`);
    process.exit(failures === 0 ? 0 : 1);
  });
