/**
 * Free-year backfill.
 *
 * The free tier became a 365-day trial rather than a plan with no end date, and
 * the deadline is read from `Subscription.trialEndsAt`. Stores created before
 * that change carry whatever `trialDays` the free plan had at the time — zero,
 * for most of them — so without this they would look expired the moment the lock
 * shipped. This grants each of them the full year, measured from the day their
 * subscription was created.
 *
 * Run `npm run db:backfill-plans` first: that sets the free plan's `trialDays`
 * to 365 so *new* stores get the year. This script is the other half, for stores
 * that already exist.
 *
 * It is idempotent and safe to re-run. Specifically it does NOT:
 * - touch a subscription on any plan other than the free tier;
 * - ever shorten a trial — a date already further out is left alone;
 * - reassign a plan, or resurrect a CANCELLED subscription.
 *
 * Run with:   npm run db:backfill-free-trials
 * Preview:    npm run db:backfill-free-trials -- --dry-run
 */
import { prisma } from "@dash/db";
import { DEFAULT_PLAN_SLUG, FREE_PLAN_TRIAL_DAYS } from "../apps/web/src/modules/admin/plan-catalog";

const dryRun = process.argv.includes("--dry-run");
const DAY_MS = 1000 * 60 * 60 * 24;

async function main() {
  if (dryRun) {
    console.log("DRY RUN — no writes will be made.\n");
  }

  const subscriptions = await prisma.subscription.findMany({
    orderBy: {
      createdAt: "asc"
    },
    select: {
      createdAt: true,
      currentPeriodEndsAt: true,
      id: true,
      status: true,
      store: {
        select: {
          name: true,
          slug: true
        }
      },
      trialEndsAt: true,
      trialStartsAt: true
    },
    where: {
      plan: {
        slug: DEFAULT_PLAN_SLUG
      }
    }
  });

  if (subscriptions.length === 0) {
    console.log(`No subscriptions on the "${DEFAULT_PLAN_SLUG}" plan. Nothing to do.`);
    return;
  }

  const now = new Date();
  let granted = 0;

  for (const subscription of subscriptions) {
    // The clock starts when the store did, not when this script runs, so
    // re-running it never hands out a second year.
    const startsAt = subscription.trialStartsAt ?? subscription.createdAt;
    const endsAt = new Date(startsAt.getTime() + FREE_PLAN_TRIAL_DAYS * DAY_MS);
    const label = `${subscription.store.slug.padEnd(18)}`;

    if (subscription.trialEndsAt && subscription.trialEndsAt >= endsAt) {
      console.log(`ok       ${label} already free until ${formatDate(subscription.trialEndsAt)}`);
      continue;
    }

    // `currentPeriodEndsAt` is set equal to the trial end when a store is
    // created, and `isEntitledSubscription` reads it, so the two have to move
    // together or the store keeps its year while losing its entitlements.
    const restoreStatus =
      subscription.status === "EXPIRED" && endsAt > now ? ("TRIALING" as const) : subscription.status;

    if (!dryRun) {
      await prisma.subscription.update({
        data: {
          currentPeriodEndsAt: endsAt,
          status: restoreStatus,
          trialEndsAt: endsAt,
          trialStartsAt: startsAt
        },
        where: {
          id: subscription.id
        }
      });
    }

    granted += 1;
    console.log(
      `granted  ${label} ${formatDate(subscription.trialEndsAt)} -> ${formatDate(endsAt)}` +
        (restoreStatus === subscription.status ? "" : `  (${subscription.status} -> ${restoreStatus})`)
    );
  }

  console.log(
    `\nDone. ${granted} of ${subscriptions.length} free subscription(s) updated to a ${FREE_PLAN_TRIAL_DAYS}-day trial.`
  );
}

function formatDate(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "unset";
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
