import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import {
  recordSchedulerTick,
  runDueCampaigns
} from "../../../../modules/campaigns/campaign-delivery.service";

/**
 * The campaign scheduler's entry point.
 *
 * Called on a timer by something outside the app — a systemd timer, a cron
 * line, or a platform scheduler — because this project runs no worker process
 * of its own. See `deploy/campaign-scheduler.md`.
 *
 * Each call starts campaigns whose scheduled time has arrived and advances the
 * ones already sending, then returns within its time budget so the next call
 * does not pile up behind it. Calling it more often than campaigns need is
 * harmless: with nothing due it does nothing.
 *
 * Unlike `/api/domains/authorize`, whose token is optional, an unset
 * `CRON_SECRET` disables this route outright. That endpoint answers a question;
 * this one spends the seller's SMS allowance, and an unauthenticated way to
 * make a server send thousands of messages is not something to leave open by
 * forgetting a variable.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  return handle(request);
}

/**
 * Also on GET, because a surprising number of hosted schedulers can only issue
 * one. It is not a read — but refusing GET would mostly mean people reaching
 * for a shell script and a stored secret in a less careful place.
 */
export async function GET(request: NextRequest) {
  return handle(request);
}

async function handle(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();

  if (!expected) {
    console.warn("[cron] CRON_SECRET is not set — the campaign scheduler is disabled.");

    return NextResponse.json({ error: "scheduler disabled" }, { status: 503 });
  }

  if (!matchesSecret(readSecret(request), expected)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Recorded on a successfully authenticated call, before the sweep runs: the
  // question it answers is "is a scheduler wired up and reaching us", which is
  // true even on a tick that finds nothing to do or fails part-way.
  recordSchedulerTick();

  try {
    const result = await runDueCampaigns({
      // Kept under `maxDuration` so a sweep returns a result rather than being
      // cut off mid-batch by the platform.
      budgetMs: 45_000
    });

    if (result.promoted.length > 0 || result.batches > 0) {
      console.info(
        `[cron] campaigns: promoted ${result.promoted.length}, ${result.batches} batches, ${result.attempted} messages attempted, ${result.completed.length} finished${result.truncated ? " (budget reached, more pending)" : ""}`
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    // Logged loudly and answered with a 500: a scheduler that silently returns
    // 200 while failing is one nobody notices has stopped working.
    console.error("[cron] campaign sweep failed:", error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "sweep failed" },
      { status: 500 }
    );
  }
}

/**
 * `Authorization: Bearer <secret>` preferred; `x-cron-secret` accepted because
 * some schedulers cannot set an Authorization header. Never a query parameter —
 * those end up in access logs.
 */
function readSecret(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (authorization?.toLowerCase().startsWith("bearer ")) {
    return authorization.slice(7).trim();
  }

  return request.headers.get("x-cron-secret")?.trim() ?? null;
}

function matchesSecret(provided: string | null, expected: string) {
  if (!provided) {
    return false;
  }

  const providedBytes = Buffer.from(provided);
  const expectedBytes = Buffer.from(expected);

  return (
    providedBytes.length === expectedBytes.length && timingSafeEqual(providedBytes, expectedBytes)
  );
}
