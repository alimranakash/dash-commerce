import type { Prisma } from "@dash/db";
import { PlanFeatureError } from "../billing/subscription-limits";
import { appendLoyaltyLedgerEntry, type LoyaltyLedgerWrite } from "./loyalty.ledger";
import {
  LoyaltyError,
  planSaleLoyalty,
  resolveSaleOptIn,
  type OrderLoyaltyContext,
  type SaleLoyaltyPlan
} from "./loyalty.rules";
import { loyaltyLedgerEntrySchema } from "./loyalty.schema";

/**
 * Where offline sales meet the programme: the customer's opt-in at the
 * counter, and the reconciliation every sale lifecycle hook runs.
 *
 * Like `loyalty.orders.ts`, everything here runs on the transaction it is
 * handed — the sale's own — so a save and its points commit together or not
 * at all. It never opens one, and the store's settings and plan are read by
 * `prepareSaleLoyalty` before that transaction starts.
 */

export type SaleLoyaltyClient = Pick<
  Prisma.TransactionClient,
  "loyaltyMember" | "loyaltyTransaction" | "sale" | "saleLoyaltyOptIn"
>;

/** The order context, plus whether the plan includes the programme — for the opt-in's refusal. */
export type SaleLoyaltyContext = OrderLoyaltyContext & { entitled: boolean };

/**
 * Records, keeps or withdraws the sale's opt-in, as `resolveSaleOptIn` says.
 *
 * Recording is checked here, on the server, whatever the form showed: the plan
 * must include the programme and the seller must have it switched on, and the
 * customer must be a member of this store whose membership is not suspended.
 * Withdrawing is never refused — like switching anything else off.
 */
export async function applySaleLoyaltyOptIn(
  client: SaleLoyaltyClient,
  storeId: string,
  input: {
    choice: "in" | "keep" | "out";
    customerId: string | null;
    saleId: string;
    userId: string | null;
  },
  context: SaleLoyaltyContext
) {
  const existing = await client.saleLoyaltyOptIn.findFirst({
    select: {
      customerId: true
    },
    where: {
      saleId: input.saleId,
      storeId
    }
  });
  const action = resolveSaleOptIn({
    choice: input.choice,
    customerId: input.customerId,
    existing
  });

  if (action === "unchanged") {
    return;
  }

  if (action === "remove") {
    await client.saleLoyaltyOptIn.deleteMany({
      where: {
        saleId: input.saleId,
        storeId
      }
    });
    return;
  }

  if (!context.entitled) {
    throw new PlanFeatureError("loyalty");
  }

  if (!context.live) {
    throw new LoyaltyError(
      "FORBIDDEN",
      "The loyalty programme is switched off, so this sale can't earn points."
    );
  }

  if (!input.customerId) {
    throw new LoyaltyError("MEMBER_NOT_FOUND", "Choose the member who is opting in.");
  }

  const member = await client.loyaltyMember.findFirst({
    select: {
      suspendedAt: true
    },
    where: {
      customerId: input.customerId,
      storeId
    }
  });

  if (!member) {
    throw new LoyaltyError(
      "MEMBER_NOT_FOUND",
      "This customer isn't a loyalty member here, so they can't opt in. Customers join by opting in at checkout."
    );
  }

  if (member.suspendedAt !== null) {
    throw new LoyaltyError(
      "FORBIDDEN",
      "This customer's membership is suspended, so they can't opt in."
    );
  }

  await client.saleLoyaltyOptIn.upsert({
    create: {
      customerId: input.customerId,
      recordedByUserId: input.userId,
      saleId: input.saleId,
      storeId
    },
    // Re-ticking the same customer's box keeps the original record; a
    // different customer's is a new consent.
    update:
      existing?.customerId === input.customerId
        ? {}
        : { createdAt: new Date(), customerId: input.customerId, recordedByUserId: input.userId },
    where: {
      saleId: input.saleId
    }
  });
}

export type SaleLoyaltyResult = {
  plan: SaleLoyaltyPlan | null;
  writes: LoyaltyLedgerWrite[];
};

/**
 * Brings one sale's earned points into line with the sale as it now stands.
 *
 * Safe to call any number of times, from any hook: it compares the sale with
 * its own ledger rows and writes only the difference, so saving the same sale
 * twice writes nothing the second time, and Completed → Cancelled → Completed
 * writes +n, −n, +n.
 *
 * The sale row is locked before its ledger rows are read, exactly as an order
 * is: two saves racing on one sale reconcile one after the other, each seeing
 * the other's committed rows, which is what keeps their keys apart and stops a
 * stale read from earning twice.
 */
export async function reconcileSaleLoyalty(
  client: SaleLoyaltyClient,
  storeId: string,
  saleId: string,
  context: OrderLoyaltyContext
): Promise<SaleLoyaltyResult> {
  // With the programme off, a sale that never earned has nothing to reverse
  // and may not earn, so most stores stop here on one indexed count.
  if (!context.live) {
    const recorded = await client.loyaltyTransaction.count({
      where: {
        sourceId: saleId,
        sourceType: "SALE",
        storeId
      }
    });

    if (recorded === 0) {
      return { plan: null, writes: [] };
    }
  }

  const locked = await client.sale.updateMany({
    data: {
      updatedAt: new Date()
    },
    where: {
      id: saleId,
      storeId
    }
  });

  if (locked.count !== 1) {
    return { plan: null, writes: [] };
  }

  const sale = await client.sale.findFirst({
    select: {
      createdAt: true,
      customerId: true,
      discount: true,
      id: true,
      loyaltyOptIn: {
        select: {
          customerId: true
        }
      },
      paymentStatus: true,
      saleDate: true,
      status: true,
      subtotal: true
    },
    where: {
      id: saleId,
      storeId
    }
  });

  if (!sale) {
    return { plan: null, writes: [] };
  }

  const lines = await client.loyaltyTransaction.findMany({
    orderBy: { sequence: "asc" },
    select: {
      amountPerPoint: true,
      memberId: true,
      points: true,
      type: true
    },
    where: {
      sourceId: saleId,
      sourceType: "SALE",
      storeId
    }
  });
  const member = sale.customerId
    ? await client.loyaltyMember.findFirst({
        select: {
          customerId: true,
          enrolledAt: true,
          id: true,
          suspendedAt: true
        },
        where: {
          customerId: sale.customerId,
          storeId
        }
      })
    : null;

  if (lines.length === 0 && !member) {
    return { plan: null, writes: [] };
  }

  const plan = planSaleLoyalty(
    {
      lines: lines.map((line) => ({
        amountPerPoint: line.amountPerPoint === null ? null : line.amountPerPoint.toString(),
        memberId: line.memberId,
        points: line.points,
        type: line.type
      })),
      member,
      optIn: sale.loyaltyOptIn,
      sale: {
        createdAt: sale.createdAt,
        customerId: sale.customerId,
        discount: sale.discount.toString(),
        id: sale.id,
        paymentStatus: sale.paymentStatus,
        saleDate: sale.saleDate,
        status: sale.status,
        subtotal: sale.subtotal.toString()
      }
    },
    context
  );
  const writes: LoyaltyLedgerWrite[] = [];

  // One at a time, in the plan's order: reversals for anyone the sale no
  // longer earns for, then the current member.
  for (const entry of plan.writes) {
    writes.push(
      await appendLoyaltyLedgerEntry(
        client,
        storeId,
        loyaltyLedgerEntrySchema.parse({
          actorUserId: null,
          amountPerPoint: entry.amountPerPoint,
          idempotencyKey: entry.correction.idempotencyKey,
          memberId: entry.memberId,
          note: null,
          points: entry.correction.points,
          sourceId: entry.correction.sourceId,
          sourceType: entry.correction.sourceType,
          type: entry.correction.type
        })
      )
    );
  }

  return { plan, writes };
}
