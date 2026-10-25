import { prisma } from "@dash/db";
import type { Prisma } from "@dash/db";
import { isUniqueConstraintError } from "../../lib/prisma-errors";
import { createSystemLog } from "../../lib/system-log";
import { requestDeferredOtpChallenge, verifyOtpChallenge } from "../auth/otp/otp.service";
import { OtpError } from "../auth/otp/otp-errors";
import { errorForLog } from "../notifications/notifications.redact";
import {
  getSmsAllowance,
  hasPlanFeature,
  requirePlanFeature
} from "../billing/subscription-limits";
import { ensureOrderReturnSchema } from "../returns/return-schema";
import {
  appendLoyaltyLedgerEntry,
  assertSameEntry,
  findLoyaltyLedgerEntryByKey,
  type LoyaltyLedgerWrite
} from "./loyalty.ledger";
import {
  enrollLoyaltyMember,
  reconcileOrderLoyalty,
  type LoyaltyEnrollment
} from "./loyalty.orders";
import type { SaleLoyaltyContext } from "./loyalty.sales";
import {
  countUnresolvedLoyaltyConflicts,
  findLedgerActors,
  findLoyaltyConflictInStore,
  findLoyaltyMemberById,
  findSaleLoyaltyOptIn,
  findLoyaltyMemberByPhoneKey,
  findLoyaltyMemberDetail,
  findLoyaltyMemberInStore,
  listOrderLoyaltyRows,
  getLoyaltyMemberTotals,
  getLoyaltySettingRecord,
  listLoyaltyLedgerPage,
  listLoyaltyMembersPage,
  listUnresolvedLoyaltyConflicts,
  resolveLoyaltyConflictRecord,
  setLoyaltyMemberSuspended,
  upsertLoyaltyConflict,
  upsertLoyaltySettingRecord,
  type LoyaltySettingRecord
} from "./loyalty.repository";
import { readRedemptionToken, signRedemptionToken } from "./loyalty.redemption";
import {
  describeOrderPoints,
  LoyaltyError,
  loyaltyCapability,
  loyaltyMembershipStatus,
  loyaltyOtpPhone,
  loyaltyPhoneKey,
  loyaltyRedemptionLive,
  memberActionNeedsPlan,
  redemptionLimits,
  splitLookaheadPage,
  type LoyaltyCapability,
  type OrderLoyaltyContext,
  type RedemptionPolicy
} from "./loyalty.rules";
import {
  adjustmentLedgerEntry,
  LOYALTY_SETTINGS_DEFAULTS,
  loyaltyAdjustmentSchema,
  loyaltyLedgerEntrySchema,
  loyaltyRecordIdSchema,
  loyaltySettingsSchema,
  type LoyaltyAdjustmentInput,
  type LoyaltyLedgerEntryInput,
  type LoyaltySettings,
  type LoyaltySettingsInput
} from "./loyalty.schema";

/**
 * Loyalty: the programme's settings, its entitlement, and the one door into
 * the points ledger.
 *
 * The plan key is `loyalty`, and it is enforced here, in the write, rather
 * than only in the page: `saveLoyaltySettings` refuses to store `enabled: true`
 * for a store whose plan does not grant it, whoever calls it. Saving with the
 * programme switched **off** is never gated — a store whose plan has lapsed
 * must always be able to stop its own programme.
 */

export type { LoyaltyCapability };

export async function getLoyaltySettings(storeId: string): Promise<LoyaltySettings> {
  const record = await getLoyaltySettingRecord(storeId);

  return record ? fromRecord(record) : { ...LOYALTY_SETTINGS_DEFAULTS };
}

export async function saveLoyaltySettings(
  storeId: string,
  input: LoyaltySettingsInput
): Promise<LoyaltySettings> {
  const settings = loyaltySettingsSchema.parse(input);

  // Either switch going on is authoring; both going off never asks.
  if (settings.enabled || settings.redemptionEnabled) {
    await requirePlanFeature(storeId, "loyalty");
  }

  return fromRecord(await upsertLoyaltySettingRecord(storeId, settings));
}

/**
 * Read back from the plan rather than trusted from the stored switch: a store
 * that switched the programme on and has since lapsed is not running it.
 */
export async function getLoyaltyCapability(
  storeId: string,
  known?: LoyaltySettings
): Promise<LoyaltyCapability> {
  const [settings, entitled] = await Promise.all([
    known ?? getLoyaltySettings(storeId),
    hasPlanFeature(storeId, "loyalty")
  ]);

  return loyaltyCapability(settings.enabled, entitled);
}

/**
 * What the checkout page offers: the programme's name and rate when it is
 * running, and nothing at all otherwise — no box is drawn for a programme a
 * shopper could not join.
 */
export async function getCheckoutLoyaltyOffer(storeId: string) {
  const settings = await getLoyaltySettings(storeId);
  const capability = await getLoyaltyCapability(storeId, settings);

  return capability.live
    ? {
        amountPerPoint: settings.amountPerPoint,
        programName: settings.programName,
        // Only the rules a shopper is shown; whether they may actually redeem,
        // and how much, is decided again when the order is placed.
        redemption: loyaltyRedemptionLive(capability, settings.redemptionEnabled)
          ? redemptionPolicy(settings)
          : null
      }
    : null;
}

/**
 * Everything an order lifecycle hook must do **before** opening its
 * transaction: read the programme's state, and make sure the returns tables
 * exist.
 *
 * Both are outside on purpose. `ensureOrderReturnSchema` creates a table with
 * a foreign key to `Order` on a database that has never been pushed, and
 * reached from inside a transaction already holding an order row it would wait
 * on that transaction forever — the deadlock `createCheckoutOrder` documents
 * for free shipping. The plan read goes to the base client either way, so
 * taking it out changes nothing but the lock it would otherwise sit beside.
 */
export async function prepareOrderLoyalty(storeId: string): Promise<OrderLoyaltyContext> {
  const settings = await getLoyaltySettings(storeId);
  const [{ live }] = await Promise.all([
    getLoyaltyCapability(storeId, settings),
    ensureOrderReturnSchema()
  ]);

  return { amountPerPoint: settings.amountPerPoint, live };
}

/**
 * What reconciling an offline sale needs to know about the store, read before
 * the sale's transaction opens — never inside it — including whether the plan
 * grants the programme, which is what refusing an opt-in turns on.
 */
export async function prepareSaleLoyalty(storeId: string): Promise<SaleLoyaltyContext> {
  const settings = await getLoyaltySettings(storeId);
  const capability = await getLoyaltyCapability(storeId, settings);

  return {
    amountPerPoint: settings.amountPerPoint,
    entitled: capability.entitled,
    live: capability.live
  };
}

/**
 * Runs an order write and reconciles the order's points in the same
 * transaction, so the two commit together or not at all.
 */
export async function runWithOrderLoyalty<T>(
  storeId: string,
  orderId: string,
  write: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  const context = await prepareOrderLoyalty(storeId);

  return prisma.$transaction(async (tx) => {
    const result = await write(tx);

    await reconcileOrderLoyalty(tx, storeId, orderId, context);

    return result;
  });
}

/**
 * A shopper ticked the box with a number that already belongs to another
 * customer record's membership. Nothing was merged and neither balance moved;
 * this is the record of it for the seller to resolve, and it never throws —
 * the order it arrived with has already committed.
 */
export async function reportLoyaltyEnrollmentConflict(
  storeId: string,
  input: { customerId: string; enrollment: LoyaltyEnrollment; orderId: string }
) {
  if (input.enrollment.action !== "conflict") {
    return;
  }

  const conflict = {
    customerId: input.customerId,
    memberId: input.enrollment.memberId,
    orderId: input.orderId,
    storeId
  };

  try {
    await upsertLoyaltyConflict(conflict);
  } catch (error) {
    // Two opt-ins on one pair filing at once: the loser's insert meets the
    // winner's row, and the second attempt is the update it should have been.
    try {
      if (!isUniqueConstraintError(error, "customerId")) {
        throw error;
      }

      await upsertLoyaltyConflict(conflict);
    } catch (retryError) {
      console.error(`[loyalty] could not record an enrolment conflict: ${errorForLog(retryError)}`);
    }
  }
}

/**
 * The membership a phone number belongs to, in whatever spelling it was
 * typed. A number the rules cannot read finds nothing rather than a guess.
 */
export async function findLoyaltyMemberByPhone(storeId: string, phone: string) {
  const phoneKey = loyaltyPhoneKey(phone);

  return phoneKey ? findLoyaltyMemberByPhoneKey(storeId, phoneKey) : null;
}

export type CounterEnrollment =
  | { action: "conflict"; holderCustomerId: string | null; memberId: string }
  | { action: "enrolled" | "existing"; memberId: string }
  | { action: "ineligible" };

/**
 * Enrols a customer at the counter, on their explicit yes, given to the
 * employee who presses the button — the dashboard's counterpart of ticking the
 * box at checkout, and the same enrolment: `enrollLoyaltyMember`, its
 * duplicate-skipping insert, its refusal to merge two customers on one number.
 *
 * Joining is all it does. It records no consent to earn on any sale — that is
 * the sale's own box — and `enrolledAt` is now, so no sale recorded before it
 * ever earns.
 *
 * Everything is re-read here rather than taken from the form: the plan, the
 * seller's switch, the customer (this store's, or nothing), and the number,
 * which is the one on the customer record. A conflict is reported back to the
 * employee, who is standing there and can pick the record that holds the
 * number; it is not filed as a `LoyaltyEnrollmentConflict`, whose rows name the
 * order that carried the opt-in, and a counter enrolment has none.
 */
export async function enrollCustomerAtCounter(
  storeId: string,
  input: { customerId: string; userId: string }
): Promise<CounterEnrollment> {
  const customerId = loyaltyRecordIdSchema.parse(input.customerId);

  await requirePlanFeature(storeId, "loyalty");

  if (!(await getLoyaltySettings(storeId)).enabled) {
    throw new LoyaltyError(
      "FORBIDDEN",
      "The loyalty programme is switched off, so nobody can join right now."
    );
  }

  const enrollment = await prisma.$transaction(async (tx) => {
    const customer = await tx.customer.findFirst({
      select: {
        id: true,
        phone: true
      },
      where: {
        id: customerId,
        storeId
      }
    });

    if (!customer) {
      throw new LoyaltyError("NOT_FOUND", "That customer does not belong to this store.");
    }

    return enrollLoyaltyMember(tx, {
      customerId: customer.id,
      enrolledAt: new Date(),
      phone: customer.phone,
      storeId
    });
  });

  if (enrollment.action === "enrolled") {
    await logLoyaltyAudit({
      message: "Customer joined the loyalty programme at the counter.",
      metadata: { customerId, memberId: enrollment.memberId, via: "sale-counter" },
      storeId,
      userId: input.userId
    });
  }

  if (enrollment.action !== "conflict") {
    return enrollment;
  }

  await logLoyaltyAudit({
    message: "Counter enrolment refused: the number already holds another customer's membership.",
    metadata: { customerId, memberId: enrollment.memberId, via: "sale-counter" },
    storeId,
    userId: input.userId
  });

  return {
    ...enrollment,
    holderCustomerId:
      (await findLoyaltyMemberById(storeId, enrollment.memberId))?.customerId ?? null
  };
}

/**
 * Records one movement of points.
 *
 * `storeId` is the caller's resolved tenant, never a value from a request; the
 * entry is re-parsed here whoever built it, so a malformed amount or a key in
 * the wrong shape stops before anything is written.
 *
 * Given a transaction, the entry joins it — that is how a later phase will
 * make an order's status and its points one commit. Without one, it gets its
 * own. In that case only, a unique violation on the key is answered as a
 * replay: it means a concurrent writer of the same event won, and the ledger
 * already says what this call came to say. (Inside somebody else's
 * transaction the violation has already aborted it, so it is theirs to retry.)
 */
export async function recordLoyaltyLedgerEntry(
  storeId: string,
  input: LoyaltyLedgerEntryInput,
  tx?: Prisma.TransactionClient
): Promise<LoyaltyLedgerWrite> {
  const entry = loyaltyLedgerEntrySchema.parse(input);

  if (tx) {
    return appendLoyaltyLedgerEntry(tx, storeId, entry);
  }

  try {
    return await prisma.$transaction((client) => appendLoyaltyLedgerEntry(client, storeId, entry));
  } catch (error) {
    if (isUniqueConstraintError(error, "idempotencyKey")) {
      const winner = await findLoyaltyLedgerEntryByKey(prisma, storeId, entry.idempotencyKey);

      if (winner) {
        return { applied: false, transaction: assertSameEntry(winner, entry) };
      }
    }

    throw error;
  }
}

/* -------------------------------------------------------------------------- */
/* Members dashboard                                                          */
/* -------------------------------------------------------------------------- */

const MEMBER_PAGE_SIZE = 25;
const LEDGER_PAGE_SIZE = 25;
const CONFLICT_LIMIT = 50;

/** Who is looking: the dashboard's own answer, never something a request names. */
export type LoyaltyViewer = { canManage: boolean };

export type LoyaltyMemberRow = {
  customerEmail: string | null;
  customerName: string;
  customerPhone: string;
  enrolledAt: Date;
  id: string;
  phoneKey: string;
  pointsBalance: number;
  status: "ACTIVE" | "SUSPENDED";
};

/**
 * One page of the store's members. A cursor that is malformed, or names a
 * member of another store, is dropped and the first page served — it can
 * never become a way to read past this store's own rows.
 */
export async function getLoyaltyMembersPage(
  storeId: string,
  input: { cursor?: string | undefined; search?: string | undefined }
) {
  const cursor =
    input.cursor &&
    loyaltyRecordIdSchema.safeParse(input.cursor).success &&
    (await findLoyaltyMemberInStore(storeId, input.cursor))
      ? input.cursor
      : undefined;
  const records = await listLoyaltyMembersPage({
    cursor,
    search: input.search,
    storeId,
    take: MEMBER_PAGE_SIZE + 1
  });
  const { hasMore, page } = splitLookaheadPage(records, MEMBER_PAGE_SIZE);

  return {
    members: page.map(
      (record): LoyaltyMemberRow => ({
        customerEmail: record.customer.email,
        customerName: record.customer.name,
        customerPhone: record.customer.phone,
        enrolledAt: record.enrolledAt,
        id: record.id,
        phoneKey: record.phoneKey,
        pointsBalance: record.pointsBalance,
        status: loyaltyMembershipStatus(record)
      })
    ),
    nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    paged: cursor !== undefined
  };
}

export function getLoyaltyMemberTotalsForStore(storeId: string) {
  return getLoyaltyMemberTotals(storeId);
}

export async function getLoyaltyMemberDetail(storeId: string, memberId: string) {
  if (!loyaltyRecordIdSchema.safeParse(memberId).success) {
    return null;
  }

  const member = await findLoyaltyMemberDetail(storeId, memberId);

  return member ? { ...member, status: loyaltyMembershipStatus(member) } : null;
}

/**
 * A page of one member's history, newest first in commit order. The member is
 * re-checked against the store by the query itself.
 */
export async function getLoyaltyMemberLedger(
  storeId: string,
  memberId: string,
  before?: string | undefined
) {
  const beforeSequence = before && /^\d{1,9}$/.test(before) ? Number(before) : undefined;
  const rows = await listLoyaltyLedgerPage({
    before: beforeSequence,
    memberId,
    storeId,
    take: LEDGER_PAGE_SIZE + 1
  });
  const { hasMore, page } = splitLookaheadPage(rows, LEDGER_PAGE_SIZE);
  const actorIds = [...new Set(page.flatMap((row) => (row.actorUserId ? [row.actorUserId] : [])))];
  const actors = new Map(
    (await findLedgerActors(actorIds)).map((user) => [user.id, user.name || user.email])
  );

  return {
    entries: page.map((row) => ({
      actorName: row.actorUserId ? (actors.get(row.actorUserId) ?? "A former team member") : null,
      amountPerPoint: row.amountPerPoint?.toString() ?? null,
      balanceAfter: row.balanceAfter,
      createdAt: row.createdAt,
      id: row.id,
      note: row.note,
      points: row.points,
      sequence: row.sequence,
      sourceId: row.sourceId,
      sourceType: row.sourceType,
      type: row.type
    })),
    nextBefore: hasMore ? (page.at(-1)?.sequence ?? null) : null
  };
}

/**
 * A manual adjustment, made by `actorUserId` — the session's own user, passed
 * in by the action and never read from the form.
 *
 * Adding points is authoring and needs the plan; taking them away does not,
 * so a lapsed store can still pull back points it gave in error. A deduction
 * may not take the balance below zero, which the ledger itself refuses. The
 * same form submitted twice is one adjustment: its request id is the key.
 */
export async function adjustLoyaltyPoints(
  storeId: string,
  actorUserId: string,
  input: LoyaltyAdjustmentInput
): Promise<LoyaltyLedgerWrite> {
  const adjustment = loyaltyAdjustmentSchema.parse(input);
  const member = await findLoyaltyMemberInStore(storeId, adjustment.memberId);

  if (!member) {
    throw new LoyaltyError("MEMBER_NOT_FOUND", "That member does not belong to this store.");
  }

  if (memberActionNeedsPlan(adjustment.points > 0 ? "add-points" : "deduct-points")) {
    await requirePlanFeature(storeId, "loyalty");
  }

  return recordLoyaltyLedgerEntry(storeId, adjustmentLedgerEntry(adjustment, actorUserId));
}

/**
 * Suspends or resumes a membership. Suspending is never gated; resuming puts
 * the member back into earning, so it needs the plan. A request for the state
 * the member is already in changes nothing and says so.
 */
export async function setLoyaltyMembershipSuspended(
  storeId: string,
  actorUserId: string,
  memberId: string,
  suspended: boolean
): Promise<{ changed: boolean; status: "ACTIVE" | "SUSPENDED" }> {
  const id = loyaltyRecordIdSchema.parse(memberId);

  if (memberActionNeedsPlan(suspended ? "suspend" : "resume")) {
    await requirePlanFeature(storeId, "loyalty");
  }

  const result = await setLoyaltyMemberSuspended(storeId, id, suspended, actorUserId);

  if (result.count === 0) {
    const member = await findLoyaltyMemberInStore(storeId, id);

    if (!member) {
      throw new LoyaltyError("MEMBER_NOT_FOUND", "That member does not belong to this store.");
    }

    return { changed: false, status: loyaltyMembershipStatus(member) };
  }

  await logLoyaltyAudit({
    message: suspended ? "Loyalty membership suspended." : "Loyalty membership resumed.",
    metadata: { memberId: id },
    storeId,
    userId: actorUserId
  });

  return { changed: true, status: suspended ? "SUSPENDED" : "ACTIVE" };
}

/**
 * Unresolved enrolment conflicts. Owners and admins only, and refused here
 * rather than only hidden in the page: the rows put two customer records side
 * by side, which is a judgement call for the people who can act on it.
 */
export async function getUnresolvedLoyaltyConflicts(viewer: LoyaltyViewer, storeId: string) {
  assertCanManage(viewer);

  return listUnresolvedLoyaltyConflicts(storeId, CONFLICT_LIMIT);
}

export async function getUnresolvedLoyaltyConflictCount(viewer: LoyaltyViewer, storeId: string) {
  assertCanManage(viewer);

  return countUnresolvedLoyaltyConflicts(storeId);
}

/** Marks a conflict dealt with. Recorded with who and when; once is enough. */
export async function resolveLoyaltyConflict(
  storeId: string,
  actorUserId: string,
  conflictId: string
) {
  const id = loyaltyRecordIdSchema.parse(conflictId);
  const result = await resolveLoyaltyConflictRecord(storeId, id, actorUserId);

  if (result.count === 0) {
    if (!(await findLoyaltyConflictInStore(storeId, id))) {
      throw new LoyaltyError("NOT_FOUND", "That conflict does not belong to this store.");
    }

    return { changed: false };
  }

  await logLoyaltyAudit({
    message: "Loyalty enrolment conflict marked resolved.",
    metadata: { conflictId: id },
    storeId,
    userId: actorUserId
  });

  return { changed: true };
}

function assertCanManage(viewer: LoyaltyViewer) {
  if (!viewer.canManage) {
    throw new LoyaltyError("FORBIDDEN", "Only the store owner or an admin can see this.");
  }
}

/**
 * The audit line for a membership decision. Never allowed to fail the change
 * it records, which has already committed — the same rule the AI API's action
 * log follows.
 */
async function logLoyaltyAudit(input: {
  message: string;
  metadata: Record<string, string>;
  storeId: string;
  userId: string;
}) {
  try {
    await createSystemLog({
      level: "INFO",
      message: input.message,
      metadata: input.metadata,
      source: "STORE",
      storeId: input.storeId,
      userId: input.userId
    });
  } catch (error) {
    console.error(`[loyalty] could not write the audit log: ${errorForLog(error)}`);
  }
}

/** The order page's sentence about what this order's points did, or null. */
export async function getOrderPointsNote(storeId: string, orderId: string) {
  return describeOrderPoints(await listOrderLoyaltyRows(storeId, orderId));
}

/**
 * Whether an offline sale's customer opted in to earn on it — true only while
 * the opt-in names the customer the sale is for, so the edit form never shows a
 * ticked box for consent somebody else gave.
 */
export async function isSaleOptedIn(
  storeId: string,
  sale: { customerId: string | null; id: string }
) {
  const optIn = await findSaleLoyaltyOptIn(storeId, sale.id);

  return optIn !== null && sale.customerId !== null && optIn.customerId === sale.customerId;
}

function fromRecord(record: LoyaltySettingRecord): LoyaltySettings {
  return {
    amountPerPoint: record.amountPerPoint.toFixed(2),
    enabled: record.enabled,
    maxRedeemPercent: record.maxRedeemPercent,
    minRedeemPoints: record.minRedeemPoints,
    pointValue: record.pointValue.toFixed(2),
    programName: record.programName,
    redemptionEnabled: record.redemptionEnabled
  };
}

function redemptionPolicy(settings: LoyaltySettings): RedemptionPolicy {
  return {
    maxRedeemPercent: settings.maxRedeemPercent,
    minRedeemPoints: settings.minRedeemPoints,
    pointValue: settings.pointValue
  };
}

/* -------------------------------------------------------------------------- */
/* Checkout redemption                                                        */
/* -------------------------------------------------------------------------- */

/** Redemption's standing right now: the programme, the plan and its own switch. */
export async function getRedemptionContext(storeId: string) {
  const settings = await getLoyaltySettings(storeId);
  const capability = await getLoyaltyCapability(storeId, settings);

  return {
    live: loyaltyRedemptionLive(capability, settings.redemptionEnabled),
    policy: redemptionPolicy(settings),
    programName: settings.programName
  };
}

/**
 * Sends the code that proves a shopper owns the number their points are kept
 * under. It comes out of the seller's SMS allowance; with none left there is
 * nothing to send, so redemption is unavailable while checkout carries on.
 *
 * Every number gets the same challenge, written the same way, and the same
 * reply; only a member's code is ever sent, and it is sent after the reply has
 * gone, through `context.schedule` (the route passes Next's `after`). Waiting
 * for the gateway would make a member's answer slower than anyone else's,
 * which says who is a member as plainly as an error would — and so would a
 * gateway refusal, which therefore never reaches the shopper either. It is in
 * the delivery log and the server log; the member simply gets no code and
 * cannot redeem, and checkout carries on without points.
 */
export async function requestLoyaltyRedemptionCode(
  storeId: string,
  input: { phone: string },
  context: { ipAddress: string | null; schedule: (task: () => Promise<void>) => void }
) {
  const redemption = await getRedemptionContext(storeId);

  if (!redemption.live) {
    throw new OtpError(
      "INVALID_IDENTIFIER",
      "This shop isn't taking points at checkout right now."
    );
  }

  const allowance = await getSmsAllowance(storeId);

  if (allowance.remaining !== null && allowance.remaining <= 0) {
    throw new OtpError("INVALID_IDENTIFIER", "Points can't be used at this shop right now.");
  }

  const phone = loyaltyOtpPhone(input.phone);

  if (!phone) {
    throw new OtpError("INVALID_IDENTIFIER", "Enter a valid Bangladesh mobile number.");
  }

  const member = await findLoyaltyMemberByPhoneKey(storeId, phone);
  const redeemable = member !== null && member.suspendedAt === null;

  const { deliver, ticket } = await requestDeferredOtpChallenge({
    identifier: { channel: "SMS", phone },
    ipAddress: context.ipAddress,
    purpose: "LOYALTY",
    storeId
  });

  if (redeemable) {
    context.schedule(deliver);
  }

  return toCodeReceipt(ticket.identifier, ticket.resendAvailableAt, ticket.devCode);
}

/**
 * The one public shape a code request answers with, member or not. Nothing in
 * it says whether a message was or will be sent; `devCode` exists only in a
 * development build, on every number alike, and never in production.
 */
function toCodeReceipt(identifier: string, resendAvailableAt: Date, devCode?: string) {
  return {
    ...(devCode === undefined ? {} : { devCode }),
    identifier,
    resendAvailableAt
  };
}

/**
 * Checks the code, and only then says what the member holds. The code is spent
 * here; what comes back is a token proving the number was verified, which the
 * order presents when it is placed.
 */
export async function verifyLoyaltyRedemptionCode(
  storeId: string,
  input: { code: string; phone: string; submissionId: string }
) {
  const redemption = await getRedemptionContext(storeId);

  if (!redemption.live) {
    throw new OtpError(
      "INVALID_IDENTIFIER",
      "This shop isn't taking points at checkout right now."
    );
  }

  const phone = loyaltyOtpPhone(input.phone);

  if (!phone) {
    throw new OtpError("INVALID_IDENTIFIER", "Enter a valid Bangladesh mobile number.");
  }

  const submissionId = readSubmissionId(input.submissionId);

  // Checked before the code is spent, so a page that cannot carry a token
  // does not burn the shopper's code finding that out.
  if (!submissionId) {
    throw new OtpError("INVALID_IDENTIFIER", "Reload the checkout page and try again.");
  }

  await verifyOtpChallenge({
    code: input.code,
    identifier: { channel: "SMS", phone },
    purpose: "LOYALTY",
    storeId
  });

  const member = await findLoyaltyMemberByPhoneKey(storeId, phone);

  if (!member) {
    throw new LoyaltyError("MEMBER_NOT_FOUND", "There are no points on this number at this shop.");
  }

  if (member.suspendedAt !== null) {
    throw new LoyaltyError("FORBIDDEN", "Points on this number can't be used right now.");
  }

  return {
    balance: member.pointsBalance,
    policy: redemption.policy,
    programName: redemption.programName,
    token: signRedemptionToken({ memberId: member.id, phoneKey: phone, storeId, submissionId })
  };
}

/** A submission id in the shape checkout itself accepts, or null. */
function readSubmissionId(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();

  return trimmed && trimmed.length <= 64 ? trimmed : null;
}

/**
 * The one reading of a redemption token, shared by the quote and the order:
 * redemption is live, and the token is genuine, unexpired, this store's,
 * issued for this number, and for this checkout page load.
 */
async function readRedemptionClaim(
  storeId: string,
  input: {
    phone: string;
    submissionId: string | null | undefined;
    token: string | null | undefined;
  }
) {
  const redemption = await getRedemptionContext(storeId);

  if (!redemption.live) {
    throw new LoyaltyError(
      "FORBIDDEN",
      "This shop isn't taking points right now. Remove them to place your order."
    );
  }

  const claim = readRedemptionToken(input.token);

  if (!claim || claim.storeId !== storeId) {
    throw new LoyaltyError(
      "FORBIDDEN",
      "Your points verification has expired. Verify your number again, or remove the points."
    );
  }

  if (claim.phoneKey !== loyaltyPhoneKey(input.phone)) {
    throw new LoyaltyError(
      "FORBIDDEN",
      "Your points were verified for a different number. Verify this one, or remove the points."
    );
  }

  if (claim.submissionId !== readSubmissionId(input.submissionId)) {
    throw new LoyaltyError(
      "FORBIDDEN",
      "Your points were verified for another checkout. Verify your number again, or remove the points."
    );
  }

  return { claim, policy: redemption.policy };
}

/**
 * The most this member can redeem on the order the page is showing, worked
 * out on the server from the same base the order will use. This is what the
 * checkout displays, so the maximum a shopper is offered is the maximum the
 * order accepts; the order still re-reads the balance inside its own
 * transaction.
 */
export async function quoteCheckoutRedemption(
  storeId: string,
  input: {
    eligibleGoodsCents: number;
    phone: string;
    submissionId: string | null | undefined;
    token: string | null | undefined;
  }
) {
  const { claim, policy } = await readRedemptionClaim(storeId, input);
  const member = await findLoyaltyMemberById(storeId, claim.memberId);

  if (!member) {
    throw new LoyaltyError("MEMBER_NOT_FOUND", "There are no points on this number at this shop.");
  }

  if (member.suspendedAt !== null) {
    throw new LoyaltyError("FORBIDDEN", "Points on this number can't be used right now.");
  }

  const limits = redemptionLimits({
    balance: member.pointsBalance,
    eligibleGoodsCents: input.eligibleGoodsCents,
    policy
  });

  return {
    available: limits.available,
    balance: member.pointsBalance,
    maxPoints: limits.maxPoints,
    minPoints: limits.minPoints,
    pointValueCents: limits.pointValueCents
  };
}

export type CheckoutRedemptionRequest = {
  memberId: string;
  points: number;
  policy: RedemptionPolicy;
};

/**
 * Everything about a redemption that can be decided before the order's
 * transaction opens: redemption is live, the token is genuine, unexpired, this
 * store's, and was issued for the number on this order. The balance, the
 * member's state and the limits are decided again inside the transaction.
 */
export async function readCheckoutRedemption(
  storeId: string,
  input: {
    phone: string;
    points: number;
    submissionId: string | null | undefined;
    token: string | undefined;
  }
): Promise<CheckoutRedemptionRequest> {
  const { claim, policy } = await readRedemptionClaim(storeId, input);

  return { memberId: claim.memberId, points: input.points, policy };
}
