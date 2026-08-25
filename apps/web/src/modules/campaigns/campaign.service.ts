import { prisma, PrismaValues } from "@dash/db";
import { checkCampaignAllowance } from "./campaign-delivery.service";
import { findUnfillablePlaceholders } from "./campaign-message";
import { compileAudienceRules } from "./audience.compiler";
import { ALL_CUSTOMERS_RULES, audienceRulesSchema, type AudienceRules } from "./audience.schema";
import {
  createCampaignRecord,
  deleteCampaignRecord,
  getCampaignByIdForStore,
  getCampaignCountsForStore,
  getCampaignRecipientCounts,
  getCampaignRecipients,
  getCampaignsForStore,
  insertCampaignRecipients,
  updateCampaignRecord,
  type CampaignFilters,
  type CampaignRecipientSeed
} from "./campaign.repository";
import {
  countSmsSegments,
  createCampaignSchema,
  updateCampaignSchema,
  type CampaignFormInput
} from "./campaign.schema";

export {
  getCampaignByIdForStore,
  getCampaignCountsForStore,
  getCampaignRecipientCounts,
  getCampaignRecipients,
  getCampaignsForStore
};
export type { CampaignFilters };

export class CampaignError extends Error {
  readonly field: string;

  constructor(message: string, field = "form") {
    super(message);
    this.name = "CampaignError";
    this.field = field;
  }
}

/** Statuses a seller may still edit. Once a send starts, the message is fixed. */
const EDITABLE_STATUSES = new Set(["DRAFT", "PAUSED"]);

export async function createCampaign(storeId: string, input: CampaignFormInput) {
  const data = createCampaignSchema.parse(input);

  await assertCouponBelongsToStore(storeId, data.couponId);
  await assertAudienceBelongsToStore(storeId, data.audienceId);

  return createCampaignRecord({
    body: data.body,
    channel: data.channel,
    couponId: data.couponId ?? null,
    name: data.name,
    status: "DRAFT",
    storeId,
    subject: data.subject ?? null,
    ...audienceWriteData(data)
  });
}

/**
 * A campaign targets a saved audience *or* rules of its own, never both.
 *
 * The unchosen one is written as `null` rather than omitted, so switching a
 * draft from a saved segment to custom rules actually drops the segment instead
 * of leaving a stale link that `resolveCampaignRules` would still find.
 */
function audienceWriteData(data: { audienceId?: string | undefined; rules?: AudienceRules | undefined }) {
  if (data.audienceId) {
    // Snapshot stays null while it is a draft: the point of a saved audience is
    // that the campaign follows it until the recipient list is built.
    return { audienceId: data.audienceId, audienceSnapshot: PrismaValues.DbNull };
  }

  return {
    audienceId: null,
    ...(data.rules ? { audienceSnapshot: data.rules } : { audienceSnapshot: PrismaValues.DbNull })
  };
}

export async function updateCampaign(
  storeId: string,
  campaignId: string,
  input: CampaignFormInput
) {
  const data = updateCampaignSchema.parse(input);
  const existing = await getCampaignByIdForStore(storeId, campaignId);

  if (!existing) {
    return null;
  }

  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new CampaignError(
      `${existing.name} has already started sending and can no longer be edited.`
    );
  }

  await assertCouponBelongsToStore(storeId, data.couponId);
  await assertAudienceBelongsToStore(storeId, data.audienceId);

  return updateCampaignRecord(storeId, campaignId, {
    body: data.body,
    channel: data.channel,
    couponId: data.couponId ?? null,
    name: data.name,
    subject: data.subject ?? null,
    ...audienceWriteData(data)
  });
}

/**
 * A campaign that has gone out is a record of something that happened, so only
 * one that never started can be removed. Anything else is history.
 */
export async function deleteCampaign(storeId: string, campaignId: string) {
  const existing = await getCampaignByIdForStore(storeId, campaignId);

  if (!existing) {
    return null;
  }

  if (!EDITABLE_STATUSES.has(existing.status)) {
    throw new CampaignError(
      `${existing.name} has already been sent and cannot be deleted.`
    );
  }

  await deleteCampaignRecord(storeId, campaignId);

  return existing;
}

/* -------------------------------------------------------------------------- */
/*                          Audience reach and ledger                         */
/* -------------------------------------------------------------------------- */

export type AudienceReach = {
  /** Match the rules but have opted out of this channel. */
  optedOut: number;
  /** Will actually be messaged. */
  reachable: number;
  /** Match the rules but have no usable phone or email. */
  unreachable: number;
  /** Match the rules, before reachability is considered. */
  matched: number;
};

/**
 * How many people a rule set would actually reach, broken down by why the rest
 * would not be.
 *
 * A single "1,240 customers" figure is the number sellers over-trust — it hides
 * that a third of them opted out and a handful have no phone number. Splitting
 * it here means the send confirmation can show what will really happen before
 * anyone spends their SMS allowance finding out.
 */
export async function previewAudienceReach(
  storeId: string,
  rules: AudienceRules,
  channel: "SMS" | "EMAIL" = "SMS"
): Promise<AudienceReach> {
  const where = await compileAudienceRules(storeId, rules);
  const contactable = channelContactFilter(channel);
  const optOutField = channel === "SMS" ? "marketingSmsOptOut" : "marketingEmailOptOut";

  const [matched, reachable, optedOut] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.count({ where: { ...where, ...contactable, [optOutField]: false } }),
    prisma.customer.count({ where: { ...where, ...contactable, [optOutField]: true } })
  ]);

  return {
    matched,
    optedOut,
    reachable,
    // Whatever is left once the opted-out and the reachable are accounted for:
    // people the rules matched but who have nothing to send to.
    unreachable: matched - reachable - optedOut
  };
}

/**
 * Only customers who have something to send to on this channel.
 *
 * `phone` is non-nullable on `Customer`, so an empty string is the only way to
 * be unreachable by SMS; `email` is nullable and has to exclude both.
 */
function channelContactFilter(channel: "SMS" | "EMAIL") {
  return channel === "SMS"
    ? { phone: { not: "" } }
    : { email: { not: null as string | null, notIn: [""] } };
}

export type MaterialiseResult = {
  /** Rows newly written. Lower than `reachable` on a re-run that found most already there. */
  inserted: number;
  reach: AudienceReach;
};

/**
 * Freezes an audience into the campaign's recipient ledger.
 *
 * This is the moment a campaign stops being a description of people and becomes
 * a list of them. Everything after it works from the rows, so a customer who
 * opts out mid-send is not re-queried — which is why opt-out is applied here,
 * and why a send that is paused and resumed reaches exactly who it started out
 * addressing.
 *
 * Safe to run again: the unique constraint on `(campaignId, recipient)` means a
 * retry tops up the list rather than duplicating it.
 */
export async function materialiseCampaignRecipients(
  storeId: string,
  campaignId: string,
  rules: AudienceRules,
  channel: "SMS" | "EMAIL" = "SMS"
): Promise<MaterialiseResult> {
  const where = await compileAudienceRules(storeId, rules);
  const optOutField = channel === "SMS" ? "marketingSmsOptOut" : "marketingEmailOptOut";

  const customers = await prisma.customer.findMany({
    where: {
      ...where,
      ...channelContactFilter(channel),
      [optOutField]: false
    },
    select: {
      email: true,
      id: true,
      name: true,
      phone: true
    }
  });

  const seeds: CampaignRecipientSeed[] = [];
  // Two customer rows can share an email even though phone is unique per store.
  // The database would reject the second anyway; catching it here keeps the
  // insert count honest about how many people are really being reached.
  const seen = new Set<string>();

  for (const customer of customers) {
    const recipient = (channel === "SMS" ? customer.phone : customer.email)?.trim();

    if (!recipient || seen.has(recipient)) {
      continue;
    }

    seen.add(recipient);
    seeds.push({ customerId: customer.id, name: customer.name, recipient });
  }

  const inserted = await insertCampaignRecipients(campaignId, seeds);
  const reach = await previewAudienceReach(storeId, rules, channel);

  await updateCampaignRecord(storeId, campaignId, {
    // The snapshot is written here, not when the campaign was composed. A
    // campaign pointing at a saved audience follows that audience while it is
    // still a draft — which is the point of saving one — and stops following it
    // the moment its recipient list exists. Without this, editing an audience
    // would silently rewrite who a finished campaign says it went to.
    audienceSnapshot: rules,
    totalCount: (await getCampaignRecipientCounts(campaignId)).total
  });

  return { inserted, reach };
}

/** The rules a campaign should be evaluated against, whatever it stores them as. */
export function resolveCampaignRules(campaign: {
  audience: { rules: unknown } | null;
  audienceSnapshot: unknown;
}): AudienceRules {
  // The snapshot wins when present: a running or finished campaign must answer
  // with who it was addressed to, not with what the audience says today.
  const source = campaign.audienceSnapshot ?? campaign.audience?.rules ?? null;

  if (source === null) {
    return ALL_CUSTOMERS_RULES;
  }

  const parsed = audienceRulesSchema.safeParse(source);

  // Stored JSON that no longer parses means the rule format moved on. Falling
  // back to "everyone" would silently widen a send, so this narrows instead.
  return parsed.success ? parsed.data : [];
}

/** Per-message cost, and what the whole send would come to. */
export function estimateCampaignCost(body: string, recipientCount: number) {
  const { limit, segments, unicode } = countSmsSegments(body);

  return {
    characters: body.length,
    limit,
    segmentsPerMessage: segments,
    totalSegments: segments * recipientCount,
    unicode
  };
}

/* -------------------------------------------------------------------------- */
/*                                  Sending                                   */
/* -------------------------------------------------------------------------- */

export type CampaignPreflight = {
  allowance: Awaited<ReturnType<typeof checkCampaignAllowance>>;
  /** Reasons the campaign must not start. Empty means it may. */
  blockers: string[];
  recipientCount: number;
};

/**
 * Everything that has to be true before a campaign is allowed to start.
 *
 * Gathered in one place and reported all at once. A seller who fixes one
 * problem, presses send, and is told about the next one has been made to
 * discover their own campaign's readiness by trial and error.
 */
export async function preflightCampaign(
  storeId: string,
  campaignId: string
): Promise<CampaignPreflight | null> {
  const campaign = await getCampaignByIdForStore(storeId, campaignId);

  if (!campaign) {
    return null;
  }

  const counts = await getCampaignRecipientCounts(campaignId);
  const allowance = await checkCampaignAllowance(storeId, campaign.body, counts.pending);
  const blockers: string[] = [];

  if (counts.total === 0) {
    blockers.push("This campaign has no recipients yet. Build the recipient list first.");
  } else if (counts.pending === 0) {
    blockers.push("Every recipient on this campaign has already been attempted.");
  }

  for (const placeholder of findUnfillablePlaceholders(campaign.body, {
    hasCoupon: Boolean(campaign.couponId)
  })) {
    blockers.push(
      `The message uses {{${placeholder}}} but no coupon is attached — it would go out as written.`
    );
  }

  if (!allowance.sufficient) {
    blockers.push(
      `This send needs ${allowance.required.toLocaleString("en")} SMS segments and the plan has ${allowance.remaining?.toLocaleString("en") ?? "0"} left this month.`
    );
  }

  return { allowance, blockers, recipientCount: counts.pending };
}

/**
 * Moves a campaign into SENDING. Does not send anything itself.
 *
 * The status change and the sending are separate on purpose: whoever pressed
 * the button gets an immediate answer about whether the campaign started, and
 * the messages go out through the same batch runner the scheduler uses, rather
 * than inside the request that happened to trigger them.
 */
export async function startCampaign(storeId: string, campaignId: string) {
  const campaign = await getCampaignByIdForStore(storeId, campaignId);

  if (!campaign) {
    return null;
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
    throw new CampaignError(`${campaign.name} is already ${campaign.status.toLowerCase()}.`);
  }

  const preflight = await preflightCampaign(storeId, campaignId);

  if (preflight && preflight.blockers.length > 0) {
    throw new CampaignError(preflight.blockers[0] ?? "This campaign cannot be sent yet.");
  }

  return updateCampaignRecord(storeId, campaignId, {
    // Cleared so a campaign resumed after an allowance pause does not keep
    // showing the reason it stopped last time.
    errorMessage: null,
    startedAt: campaign.startedAt ?? new Date(),
    status: "SENDING"
  });
}

/**
 * Queues a campaign to start on its own at a given time.
 *
 * The same preflight as an immediate send runs now rather than at the scheduled
 * moment. A campaign that turns out to be unsendable should say so while
 * someone is still looking at it, not fail silently at 6am into a log nobody
 * reads.
 */
export async function scheduleCampaign(storeId: string, campaignId: string, scheduledAt: Date) {
  const campaign = await getCampaignByIdForStore(storeId, campaignId);

  if (!campaign) {
    return null;
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
    throw new CampaignError(`${campaign.name} is already ${campaign.status.toLowerCase()}.`);
  }

  if (Number.isNaN(scheduledAt.getTime())) {
    throw new CampaignError("That is not a valid date and time.", "scheduledAt");
  }

  // A minute of slack, so "schedule for 9:00" typed at 8:59:58 is not refused
  // for being in the past by the time it reaches the server.
  if (scheduledAt.getTime() < Date.now() - 60_000) {
    throw new CampaignError("Pick a time in the future.", "scheduledAt");
  }

  const preflight = await preflightCampaign(storeId, campaignId);

  if (preflight && preflight.blockers.length > 0) {
    throw new CampaignError(preflight.blockers[0] ?? "This campaign cannot be scheduled yet.");
  }

  return updateCampaignRecord(storeId, campaignId, {
    errorMessage: null,
    scheduledAt,
    status: "SCHEDULED"
  });
}

/** Takes a campaign back out of the queue, leaving it editable. */
export async function unscheduleCampaign(storeId: string, campaignId: string) {
  const campaign = await getCampaignByIdForStore(storeId, campaignId);

  if (!campaign) {
    return null;
  }

  if (campaign.status !== "SCHEDULED") {
    throw new CampaignError(`${campaign.name} is not scheduled.`);
  }

  return updateCampaignRecord(storeId, campaignId, { scheduledAt: null, status: "DRAFT" });
}

export async function pauseCampaign(storeId: string, campaignId: string) {
  const campaign = await getCampaignByIdForStore(storeId, campaignId);

  if (!campaign) {
    return null;
  }

  if (campaign.status !== "SENDING") {
    throw new CampaignError(`${campaign.name} is not sending.`);
  }

  return updateCampaignRecord(storeId, campaignId, { status: "PAUSED" });
}

/**
 * Stops a campaign for good and writes off whatever it had not reached.
 *
 * Pending rows become SKIPPED rather than being deleted: "we decided not to
 * message these 400 people" is a different fact from "these 400 people were
 * never on the list", and only one of them is true here.
 */
export async function cancelCampaign(storeId: string, campaignId: string) {
  const campaign = await getCampaignByIdForStore(storeId, campaignId);

  if (!campaign) {
    return null;
  }

  if (campaign.status === "SENT" || campaign.status === "CANCELLED") {
    throw new CampaignError(`${campaign.name} has already finished.`);
  }

  await prisma.campaignRecipient.updateMany({
    where: { campaignId, status: { in: ["PENDING", "SENDING"] } },
    data: { claimToken: null, errorMessage: "Campaign cancelled.", status: "SKIPPED" }
  });

  return updateCampaignRecord(storeId, campaignId, {
    completedAt: new Date(),
    status: "CANCELLED"
  });
}

async function assertCouponBelongsToStore(storeId: string, couponId: string | undefined) {
  if (!couponId) {
    return;
  }

  const coupon = await prisma.coupon.findFirst({
    where: { id: couponId, storeId },
    select: { id: true }
  });

  if (!coupon) {
    throw new CampaignError("That coupon does not belong to this store.", "couponId");
  }
}

async function assertAudienceBelongsToStore(storeId: string, audienceId: string | undefined) {
  if (!audienceId) {
    return;
  }

  const audience = await prisma.campaignAudience.findFirst({
    where: { id: audienceId, storeId },
    select: { id: true }
  });

  if (!audience) {
    throw new CampaignError("That audience does not belong to this store.", "audienceId");
  }
}
