import { randomUUID } from "node:crypto";
import { prisma } from "@dash/db";
import { getSmsAllowance } from "../billing/subscription-limits";
import { sendSms } from "../notifications/notifications.service";
import { renderCampaignBody } from "./campaign-message";
import { countSmsSegments } from "./campaign.schema";
import { getCampaignRecipientCounts } from "./campaign.repository";

/**
 * The sending half of campaigns.
 *
 * Nothing here knows how it was triggered. `runCampaignBatch` is called by the
 * progress screen while a seller watches, and will be called by the scheduler
 * for campaigns nobody is watching — keeping it a plain function with no
 * request, session or transport in its signature is what lets the same code
 * serve both without either becoming a special case.
 */

/** How many messages one batch attempts. Small enough to stay responsive. */
export const CAMPAIGN_BATCH_SIZE = 25;

export type CampaignBatchResult = {
  /** No PENDING recipients remain — the campaign is finished or stopped. */
  done: boolean;
  attempted: number;
  failed: number;
  /** Set when the batch stopped the campaign rather than finishing it. */
  pausedReason?: string;
  sent: number;
  skipped: number;
  status: string;
};

/**
 * Attempts one batch of a campaign's pending recipients.
 *
 * Safe to call concurrently: the claim is a conditional `updateMany` stamped
 * with a token, so two runners that reach for the same rows cannot both get
 * them. Safe to call after a crash: rows left in `SENDING` by a runner that
 * died are reclaimed by `recoverStalledRecipients` rather than lost.
 */
export async function runCampaignBatch(
  campaignId: string,
  limit = CAMPAIGN_BATCH_SIZE
): Promise<CampaignBatchResult> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: {
      coupon: { select: { code: true } },
      store: { select: { name: true } }
    }
  });

  if (!campaign) {
    return emptyResult("MISSING");
  }

  if (campaign.status !== "SENDING") {
    // Paused, cancelled or already finished. Not an error — a scheduler tick
    // that arrives after a seller pressed pause should simply do nothing.
    return emptyResult(campaign.status);
  }

  // Checked once per batch rather than per message: an allowance that runs out
  // mid-campaign should stop the campaign, not quietly mark the rest BLOCKED
  // one at a time while the seller watches a progress bar creep forward.
  const allowance = await getSmsAllowance(campaign.storeId);

  if (allowance.remaining !== null && allowance.remaining <= 0) {
    const reason = `This store has used its monthly SMS allowance (${allowance.used} of ${allowance.limit}). The campaign is paused and will continue once the allowance resets or the plan is upgraded.`;

    await pauseCampaign(campaignId, reason);

    return { ...emptyResult("PAUSED"), pausedReason: reason };
  }

  const claimed = await claimRecipients(campaignId, limit);

  if (claimed.length === 0) {
    await finishCampaign(campaignId);

    return emptyResult("SENT", true);
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const recipient of claimed) {
    const message = renderCampaignBody(campaign.body, {
      couponCode: campaign.coupon?.code ?? null,
      name: recipient.name,
      storeName: campaign.store.name
    });

    try {
      const outcome = await sendSms({
        message,
        storeId: campaign.storeId,
        template: "campaign",
        to: recipient.recipient
      });

      if (outcome.status === "BLOCKED") {
        // The allowance ran out between the batch check and this message.
        // Record it honestly and stop rather than pushing on into a wall.
        await settle(recipient.id, "BLOCKED", { errorMessage: "Plan SMS allowance reached." });

        const reason = "The store's monthly SMS allowance ran out part-way through this campaign.";

        await releaseClaims(campaignId);
        await pauseCampaign(campaignId, reason);
        await syncCounters(campaignId);

        return { attempted: sent + failed + skipped + 1, done: false, failed, pausedReason: reason, sent, skipped, status: "PAUSED" };
      }

      // SKIPPED means no gateway is configured and the message went to the log.
      // Recorded as its own state so a store that never wired up SMS does not
      // read a campaign of log lines as a campaign of delivered messages.
      if (outcome.status === "SKIPPED") {
        skipped += 1;
        await settle(recipient.id, "SKIPPED", {
          errorMessage: "No SMS gateway is configured — the message was logged only."
        });
        continue;
      }

      sent += 1;
      await settle(recipient.id, "SENT", {
        providerMessageId: outcome.providerMessageId,
        sentAt: new Date()
      });
    } catch (error) {
      failed += 1;
      await settle(recipient.id, "FAILED", {
        errorMessage: error instanceof Error ? error.message.slice(0, 500) : "Send failed."
      });
    }
  }

  await syncCounters(campaignId);

  const remaining = await prisma.campaignRecipient.count({
    where: { campaignId, status: "PENDING" }
  });

  if (remaining === 0) {
    await finishCampaign(campaignId);
  }

  return {
    attempted: claimed.length,
    done: remaining === 0,
    failed,
    sent,
    skipped,
    status: remaining === 0 ? "SENT" : "SENDING"
  };
}

/**
 * Takes ownership of up to `limit` pending rows.
 *
 * The two-step — read candidates, then conditionally claim them — is what makes
 * this safe without a queue server. The `status: "PENDING"` in the update's own
 * where-clause means a row another runner already took simply is not updated,
 * and the token makes the read-back return this runner's rows and no one
 * else's.
 */
async function claimRecipients(campaignId: string, limit: number) {
  const candidates = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
    take: limit
  });

  if (candidates.length === 0) {
    return [];
  }

  const claimToken = randomUUID();

  await prisma.campaignRecipient.updateMany({
    where: {
      id: { in: candidates.map((candidate) => candidate.id) },
      status: "PENDING"
    },
    data: {
      attempts: { increment: 1 },
      claimToken,
      status: "SENDING"
    }
  });

  return prisma.campaignRecipient.findMany({
    where: { claimToken },
    select: { id: true, name: true, recipient: true }
  });
}

async function settle(
  recipientId: string,
  status: "BLOCKED" | "FAILED" | "SENT" | "SKIPPED",
  extra: { errorMessage?: string; providerMessageId?: string | null; sentAt?: Date } = {}
) {
  await prisma.campaignRecipient.update({
    where: { id: recipientId },
    data: {
      // Cleared on the way out: a token left behind would make a future batch's
      // read-back pick up rows it never claimed.
      claimToken: null,
      errorMessage: extra.errorMessage ?? null,
      providerMessageId: extra.providerMessageId ?? null,
      sentAt: extra.sentAt ?? null,
      status
    }
  });
}

/** Hands unattempted claimed rows back to the queue. */
async function releaseClaims(campaignId: string) {
  await prisma.campaignRecipient.updateMany({
    where: { campaignId, status: "SENDING" },
    data: { claimToken: null, status: "PENDING" }
  });
}

/**
 * Returns rows a dead runner left claimed.
 *
 * A process that is killed between claiming a batch and settling it leaves rows
 * in `SENDING` forever, and those recipients would never be messaged. Anything
 * held longer than a batch could plausibly take is assumed abandoned.
 *
 * The `attempts` counter is what stops this from becoming an infinite retry: a
 * row that keeps being claimed and keeps dying is eventually left alone.
 */
export async function recoverStalledRecipients(campaignId: string, staleAfterMs = 5 * 60 * 1000) {
  const result = await prisma.campaignRecipient.updateMany({
    where: {
      attempts: { lt: 3 },
      campaignId,
      status: "SENDING",
      updatedAt: { lt: new Date(Date.now() - staleAfterMs) }
    },
    data: { claimToken: null, status: "PENDING" }
  });

  return result.count;
}

/** Counters are rebuilt from the ledger rather than incremented, so they cannot drift. */
async function syncCounters(campaignId: string) {
  const counts = await getCampaignRecipientCounts(campaignId);

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      failedCount: counts.failed,
      // Anything the gateway would not take is not something the seller reached.
      sentCount: counts.sent,
      totalCount: counts.total
    }
  });
}

async function finishCampaign(campaignId: string) {
  await syncCounters(campaignId);
  await prisma.campaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: { completedAt: new Date(), status: "SENT" }
  });
}

async function pauseCampaign(campaignId: string, reason: string) {
  await prisma.campaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: { errorMessage: reason, status: "PAUSED" }
  });
}

function emptyResult(status: string, done = false): CampaignBatchResult {
  return { attempted: 0, done, failed: 0, sent: 0, skipped: 0, status };
}

/* -------------------------------------------------------------------------- */
/*                             Unattended sweeping                            */
/* -------------------------------------------------------------------------- */

/**
 * When a scheduler last called in.
 *
 * A set `CRON_SECRET` only means someone intended to run a scheduler; it says
 * nothing about whether one is actually running. The difference matters because
 * the failure it hides is silent — a timer that was never enabled, or that broke
 * three weeks ago, looks exactly like a working one until a campaign quietly
 * fails to go out overnight.
 *
 * Deliberately in memory. It is a liveness hint, not a record, and it costs
 * nothing to be wrong for the first minute after a restart. On a deployment
 * running several instances each would have its own view — this project runs one
 * (see `deploy/dash-web.service`).
 */
let lastSchedulerTickAt: Date | null = null;

export function recordSchedulerTick() {
  lastSchedulerTickAt = new Date();
}

export function getSchedulerHealth(staleAfterMs = 10 * 60 * 1000) {
  return {
    configured: Boolean(process.env.CRON_SECRET?.trim()),
    lastTickAt: lastSchedulerTickAt,
    seenRecently:
      lastSchedulerTickAt !== null && Date.now() - lastSchedulerTickAt.getTime() < staleAfterMs
  };
}

export type CampaignSweepResult = {
  /** Campaigns that finished during this sweep. */
  completed: string[];
  /** Batches run across all campaigns. */
  batches: number;
  /** Scheduled campaigns whose time had come. */
  promoted: string[];
  /** Recipients handed back from runners that died. */
  recovered: number;
  /** True when the time budget ran out with work still pending. */
  truncated: boolean;
  attempted: number;
};

export type SweepOptions = {
  /** Wall-clock budget. A tick must finish before the next one is due. */
  budgetMs?: number;
  /** Most campaigns to touch in one sweep. */
  maxCampaigns?: number;
  now?: Date;
};

/**
 * One pass of the scheduler: start what is due, advance what is running.
 *
 * This is the whole of the unattended path. It calls the same
 * `runCampaignBatch` the progress screen calls, so a campaign a seller starts
 * and walks away from and a campaign that starts itself at 9am go out through
 * one code path rather than two that have to be kept in agreement.
 *
 * Overlapping ticks are safe and are not guarded against: two sweeps that meet
 * on the same campaign simply claim different batches of it, which is a slightly
 * faster send rather than a problem. The correctness that matters — one message
 * per recipient — is held by the claim in `claimRecipients`, not by arranging
 * for only one sweep to exist.
 */
export async function runDueCampaigns(options: SweepOptions = {}): Promise<CampaignSweepResult> {
  const budgetMs = options.budgetMs ?? 25_000;
  const maxCampaigns = options.maxCampaigns ?? 20;
  const now = options.now ?? new Date();
  const deadline = Date.now() + budgetMs;

  const result: CampaignSweepResult = {
    attempted: 0,
    batches: 0,
    completed: [],
    promoted: [],
    recovered: 0,
    truncated: false
  };

  result.promoted = await promoteDueCampaigns(now);

  const running = await prisma.campaign.findMany({
    where: { status: "SENDING" },
    orderBy: { startedAt: "asc" },
    select: { id: true },
    take: maxCampaigns
  });

  for (const campaign of running) {
    result.recovered += await recoverStalledRecipients(campaign.id);
  }

  // Round-robin rather than draining one campaign at a time: a 50,000-recipient
  // send must not hold the whole scheduler while a 200-recipient one waits.
  const queue = running.map((campaign) => campaign.id);

  while (queue.length > 0) {
    if (Date.now() >= deadline) {
      result.truncated = true;
      break;
    }

    const campaignId = queue.shift();

    if (!campaignId) {
      break;
    }

    const batch = await runCampaignBatch(campaignId);

    result.attempted += batch.attempted;
    result.batches += 1;

    if (batch.done || batch.status !== "SENDING") {
      if (batch.status === "SENT") {
        result.completed.push(campaignId);
      }

      continue;
    }

    queue.push(campaignId);
  }

  return result;
}

/**
 * Moves campaigns whose scheduled time has arrived into SENDING.
 *
 * `status: "SCHEDULED"` sits in the update's own where-clause, so two schedulers
 * that fire at the same second cannot both start the same campaign — the second
 * one updates nothing.
 */
async function promoteDueCampaigns(now: Date) {
  const due = await prisma.campaign.findMany({
    where: {
      scheduledAt: { lte: now },
      status: "SCHEDULED"
    },
    select: { id: true }
  });

  const promoted: string[] = [];

  for (const campaign of due) {
    const claimed = await prisma.campaign.updateMany({
      where: { id: campaign.id, status: "SCHEDULED" },
      data: { errorMessage: null, startedAt: now, status: "SENDING" }
    });

    if (claimed.count === 1) {
      promoted.push(campaign.id);
    }
  }

  return promoted;
}

/**
 * What a send would cost, against what the store has left this month.
 *
 * Run before a campaign starts rather than discovered during one. `sendSms`
 * already blocks an individual message once the allowance is gone, but a
 * campaign that finds this out at recipient 3,000 of 5,000 has already half
 * happened — and half a campaign is the one outcome a seller cannot undo,
 * resend, or explain to the people who did not get it.
 */
export async function checkCampaignAllowance(storeId: string, body: string, recipientCount: number) {
  const allowance = await getSmsAllowance(storeId);
  const { segments } = countSmsSegments(body);
  const required = segments * recipientCount;

  return {
    limit: allowance.limit,
    remaining: allowance.remaining,
    required,
    segmentsPerMessage: segments,
    // `remaining === null` is an unlimited plan, which nothing can exceed.
    sufficient: allowance.remaining === null || required <= allowance.remaining,
    used: allowance.used
  };
}
