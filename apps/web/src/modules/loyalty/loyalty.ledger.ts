import type { Prisma } from "@dash/db";
import { balanceFloorFor, LoyaltyError } from "./loyalty.rules";
import type { LoyaltyLedgerEntry } from "./loyalty.schema";

/**
 * The only writer of `LoyaltyTransaction`, and the only code that moves
 * `LoyaltyMember.pointsBalance`.
 *
 * Written against the client it is handed rather than importing `prisma`, so
 * it always runs inside a transaction somebody else opened — the service's
 * own, or later the order's — and so `verify-loyalty` can drive it without a
 * database. Nothing in it updates or deletes a ledger row: the ledger is
 * append-only, and a correction is a new row.
 */

export type LoyaltyLedgerClient = Pick<
  Prisma.TransactionClient,
  "loyaltyMember" | "loyaltyTransaction"
>;

export type LoyaltyTransactionRow = Prisma.LoyaltyTransactionGetPayload<Record<string, never>>;

export type LoyaltyLedgerWrite = {
  /** False when this event had already been recorded and nothing moved. */
  applied: boolean;
  transaction: LoyaltyTransactionRow;
};

/**
 * Applies one entry: the balance moves and the row is appended, together or
 * not at all.
 *
 * The order of the steps is the design.
 *
 * 1. A replay that has already committed is answered from the ledger, with no
 *    write at all. This is the common case — a double click, a retried request.
 * 2. The balance is moved with one conditional update scoped by store. That
 *    statement is also what takes the member's row lock, and every writer for
 *    the member queues behind it until this transaction ends.
 * 3. With the lock held, the key is read again. Two copies of one event can
 *    both pass step 1; the second only reaches here after the first has
 *    committed, sees its row, and gives back the points it just moved, inside
 *    the same transaction, so the net change is nothing. Answering that as a
 *    replay rather than letting the unique index throw matters when the
 *    caller's transaction holds other work: a duplicate is not a failure, and
 *    must not roll back the order it arrived with.
 * 4. The floor is checked against the balance this transaction now holds.
 *    Throwing here rolls the move back with everything else.
 * 5. The row is appended with that balance as `balanceAfter`, and with the
 *    member's new `ledgerSequence` as its `sequence`. The counter moves in the
 *    same statement as the balance and is given back with it in step 3, so a
 *    replay never burns a number and a member's history is gapless and in
 *    true commit order — which `createdAt`, a transaction's start, is not.
 */
export async function appendLoyaltyLedgerEntry(
  client: LoyaltyLedgerClient,
  storeId: string,
  entry: LoyaltyLedgerEntry
): Promise<LoyaltyLedgerWrite> {
  const replay = await findLoyaltyLedgerEntryByKey(client, storeId, entry.idempotencyKey);

  if (replay) {
    return { applied: false, transaction: assertSameEntry(replay, entry) };
  }

  const moved = await client.loyaltyMember.updateMany({
    data: {
      ledgerSequence: {
        increment: 1
      },
      pointsBalance: {
        increment: entry.points
      }
    },
    where: {
      id: entry.memberId,
      storeId
    }
  });

  if (moved.count !== 1) {
    throw new LoyaltyError("MEMBER_NOT_FOUND", "That member does not belong to this store.");
  }

  const raced = await findLoyaltyLedgerEntryByKey(client, storeId, entry.idempotencyKey);

  if (raced) {
    await client.loyaltyMember.updateMany({
      data: {
        ledgerSequence: {
          decrement: 1
        },
        pointsBalance: {
          decrement: entry.points
        }
      },
      where: {
        id: entry.memberId,
        storeId
      }
    });

    return { applied: false, transaction: assertSameEntry(raced, entry) };
  }

  const member = await client.loyaltyMember.findFirst({
    select: {
      ledgerSequence: true,
      pointsBalance: true
    },
    where: {
      id: entry.memberId,
      storeId
    }
  });

  if (!member) {
    throw new LoyaltyError("MEMBER_NOT_FOUND", "That member does not belong to this store.");
  }

  const floor = balanceFloorFor(entry);

  if (floor !== null && member.pointsBalance < floor) {
    throw new LoyaltyError(
      "INSUFFICIENT_POINTS",
      `Not enough points: this would leave a balance of ${member.pointsBalance}.`
    );
  }

  const transaction = await client.loyaltyTransaction.create({
    data: {
      actorUserId: entry.actorUserId,
      amountPerPoint: entry.amountPerPoint ?? null,
      balanceAfter: member.pointsBalance,
      idempotencyKey: entry.idempotencyKey,
      memberId: entry.memberId,
      note: entry.note,
      points: entry.points,
      sequence: member.ledgerSequence,
      sourceId: entry.sourceId,
      sourceType: entry.sourceType,
      storeId,
      type: entry.type
    }
  });

  return { applied: true, transaction };
}

export function findLoyaltyLedgerEntryByKey(
  client: LoyaltyLedgerClient,
  storeId: string,
  idempotencyKey: string
) {
  return client.loyaltyTransaction.findUnique({
    where: {
      storeId_idempotencyKey: {
        idempotencyKey,
        storeId
      }
    }
  });
}

/**
 * A key names one event. The same key arriving with a different member,
 * amount or source is a bug in whoever built it, and recording either version
 * would be guessing — so it is refused, loudly, and nothing moves.
 */
export function assertSameEntry(row: LoyaltyTransactionRow, entry: LoyaltyLedgerEntry) {
  const same =
    row.memberId === entry.memberId &&
    row.points === entry.points &&
    row.type === entry.type &&
    row.sourceType === entry.sourceType &&
    row.sourceId === entry.sourceId;

  if (!same) {
    throw new LoyaltyError(
      "IDEMPOTENCY_CONFLICT",
      `Ledger key ${entry.idempotencyKey} was already used for a different entry.`
    );
  }

  return row;
}
