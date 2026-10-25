import type { Prisma } from "@dash/db";
import { appendLoyaltyLedgerEntry, type LoyaltyLedgerWrite } from "./loyalty.ledger";
import {
  checkoutRedemptionKey,
  checkRedemption,
  decideMemberLink,
  LoyaltyError,
  loyaltyPhoneKey,
  planOrderLoyalty,
  planOrderRedemption,
  redemptionLimits,
  type OrderLoyaltyContext,
  type OrderLoyaltyFacts,
  type OrderLoyaltyPlan,
  type OrderRedemptionPlan,
  type RedemptionPolicy
} from "./loyalty.rules";
import { loyaltyLedgerEntrySchema } from "./loyalty.schema";

/**
 * Where orders meet the programme: enrolment at checkout, and the
 * reconciliation every order lifecycle hook runs.
 *
 * Like `loyalty.ledger.ts`, everything here runs on the transaction it is
 * handed — the order's own — so a status change and its points commit
 * together or not at all. It never opens one, and it never reaches a
 * self-healing `ensure*Schema`: `prepareOrderLoyalty` in the service does that
 * before the caller's transaction starts.
 */

export type OrderLoyaltyClient = Pick<
  Prisma.TransactionClient,
  "coupon" | "loyaltyMember" | "loyaltyTransaction" | "order" | "orderReturn"
>;

export type OrderLoyaltyResult = {
  plan: OrderLoyaltyPlan | { action: "none"; reason: "no-order" };
  /** What the order spent, when it spent any. */
  redemption?: { plan: OrderRedemptionPlan; write: LoyaltyLedgerWrite | null };
  write: LoyaltyLedgerWrite | null;
};

/**
 * Brings one order's earned points into line with the order as it now stands.
 *
 * Safe to call any number of times, from any hook, in any order: it compares
 * the order with its own ledger rows and writes only the difference, so the
 * same event twice writes nothing the second time and Completed → Cancelled →
 * Completed writes +n, −n, +n.
 *
 * The order row is locked before its ledger rows are read. Two status changes
 * racing on one order therefore reconcile one after the other, each seeing the
 * other's committed row — which is what keeps their idempotency keys apart and
 * stops a stale read from earning against a status that has already moved.
 */
export async function reconcileOrderLoyalty(
  client: OrderLoyaltyClient,
  storeId: string,
  orderId: string,
  context: OrderLoyaltyContext
): Promise<OrderLoyaltyResult> {
  // With the programme off, an order that never earned has nothing to reverse
  // and may not earn, so most stores stop here on one indexed count and never
  // lock anything.
  if (!context.live) {
    const recorded = await client.loyaltyTransaction.count({
      where: {
        sourceId: orderId,
        sourceType: "ORDER",
        storeId
      }
    });

    if (recorded === 0) {
      return { plan: { action: "none", reason: "not-live" }, write: null };
    }
  }

  const locked = await client.order.updateMany({
    data: {
      updatedAt: new Date()
    },
    where: {
      id: orderId,
      storeId
    }
  });

  if (locked.count !== 1) {
    return { plan: { action: "none", reason: "no-order" }, write: null };
  }

  const order = await client.order.findFirst({
    select: {
      bundleDiscountAmount: true,
      couponId: true,
      loyaltyDiscountAmount: true,
      createdAt: true,
      customerId: true,
      discountAmount: true,
      markedFakeAt: true,
      shippingAmount: true,
      status: true,
      subtotalAmount: true,
      verificationStatus: true
    },
    where: {
      id: orderId,
      storeId
    }
  });

  if (!order) {
    return { plan: { action: "none", reason: "no-order" }, write: null };
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
      sourceId: orderId,
      sourceType: "ORDER",
      storeId
    }
  });
  // The membership the order earns for: the one its rows already name, or
  // with none yet, the customer's. Read with its suspension, which stops new
  // points without stopping corrections.
  const recordedMemberId = lines[0]?.memberId ?? null;
  const memberMatch = recordedMemberId
    ? { id: recordedMemberId }
    : order.customerId
      ? { customerId: order.customerId }
      : null;
  const member = memberMatch
    ? await client.loyaltyMember.findFirst({
        select: {
          enrolledAt: true,
          id: true,
          suspendedAt: true
        },
        where: {
          ...memberMatch,
          storeId
        }
      })
    : null;

  if (lines.length === 0 && !member) {
    return { plan: { action: "none", reason: "no-member" }, write: null };
  }

  const coupon = order.couponId
    ? await client.coupon.findFirst({
        select: {
          discountType: true
        },
        where: {
          id: order.couponId,
          storeId
        }
      })
    : null;
  const returns = await client.orderReturn.findMany({
    select: {
      itemsAmount: true,
      replacementAmount: true,
      type: true
    },
    where: {
      orderId,
      status: "COMPLETED",
      storeId
    }
  });

  const facts: OrderLoyaltyFacts = {
    coupon,
    lines: lines.map((line) => ({
      amountPerPoint: line.amountPerPoint === null ? null : line.amountPerPoint.toString(),
      memberId: line.memberId,
      points: line.points,
      type: line.type
    })),
    member,
    order: {
      bundleDiscountAmount: order.bundleDiscountAmount.toString(),
      createdAt: order.createdAt,
      discountAmount: order.discountAmount.toString(),
      id: orderId,
      loyaltyDiscountAmount: order.loyaltyDiscountAmount.toString(),
      markedFakeAt: order.markedFakeAt,
      shippingAmount: order.shippingAmount.toString(),
      status: order.status,
      subtotalAmount: order.subtotalAmount.toString(),
      verificationStatus: order.verificationStatus
    },
    returns: returns.map((settled) => ({
      itemsAmount: settled.itemsAmount.toString(),
      replacementAmount: settled.replacementAmount.toString(),
      type: settled.type
    }))
  };

  // Earning first, then what the order spent: re-completing a cancelled order
  // earns before it spends again, so the balance is as high as it can be when
  // the ledger checks whether the spend still fits.
  const plan = planOrderLoyalty(facts, context);
  const write =
    plan.action === "write"
      ? await appendLoyaltyLedgerEntry(
          client,
          storeId,
          loyaltyLedgerEntrySchema.parse({
            actorUserId: null,
            amountPerPoint: plan.amountPerPoint,
            idempotencyKey: plan.correction.idempotencyKey,
            memberId: plan.memberId,
            note: null,
            points: plan.correction.points,
            sourceId: plan.correction.sourceId,
            sourceType: plan.correction.sourceType,
            type: plan.correction.type
          })
        )
      : null;
  const redemptionPlan = planOrderRedemption(facts);
  const redemptionWrite =
    redemptionPlan.action === "write"
      ? await appendLoyaltyLedgerEntry(
          client,
          storeId,
          loyaltyLedgerEntrySchema.parse({
            actorUserId: null,
            idempotencyKey: redemptionPlan.correction.idempotencyKey,
            memberId: redemptionPlan.memberId,
            note: null,
            points: redemptionPlan.correction.points,
            sourceId: redemptionPlan.correction.sourceId,
            sourceType: redemptionPlan.correction.sourceType,
            type: redemptionPlan.correction.type
          })
        )
      : null;

  return { plan, redemption: { plan: redemptionPlan, write: redemptionWrite }, write };
}

/**
 * Prices a redemption inside the checkout's transaction, once the order's
 * customer is known and its coupon has been claimed. Nothing is written here;
 * the debit follows the order, in `debitCheckoutRedemption`.
 *
 * The member must be this store's, unsuspended, and the very customer record
 * the order is being placed for. A number typed differently from the one the
 * membership was joined with is a different customer record, and spending one
 * record's points on another's order is the merge this programme refuses — so
 * it fails closed, with a message, and nothing is charged.
 *
 * The balance read here only shapes the message. The decision that cannot be
 * raced is the ledger's own, when the debit runs under the member's row lock.
 */
export async function priceCheckoutRedemption(
  client: Pick<Prisma.TransactionClient, "loyaltyMember">,
  input: {
    customerId: string;
    eligibleGoodsCents: number;
    memberId: string;
    points: number;
    policy: RedemptionPolicy;
    storeId: string;
  }
): Promise<{ discountCents: number; memberId: string; points: number }> {
  const member = await client.loyaltyMember.findFirst({
    select: {
      customerId: true,
      id: true,
      pointsBalance: true,
      suspendedAt: true
    },
    where: {
      id: input.memberId,
      storeId: input.storeId
    }
  });

  if (!member) {
    throw new LoyaltyError("MEMBER_NOT_FOUND", "There are no points on this number at this shop.");
  }

  if (member.customerId !== input.customerId) {
    throw new LoyaltyError(
      "FORBIDDEN",
      "Your points are kept under this number as you first entered it. Enter it the same way to use them, or remove the points."
    );
  }

  if (member.suspendedAt !== null) {
    throw new LoyaltyError("FORBIDDEN", "Points on this number can't be used right now.");
  }

  const check = checkRedemption(
    input.points,
    redemptionLimits({
      balance: member.pointsBalance,
      eligibleGoodsCents: input.eligibleGoodsCents,
      policy: input.policy
    })
  );

  if (!check.ok) {
    throw new LoyaltyError("INSUFFICIENT_POINTS", check.message);
  }

  return { discountCents: check.discountCents, memberId: member.id, points: check.points };
}

/**
 * Spends the points, after the order exists so the row can name it, in the
 * same transaction. If the balance no longer covers it — another checkout
 * spent the same points a moment ago — the ledger throws and the order goes
 * with it: no discounted order without its debit, no debit without its order.
 *
 * Keyed by the order, so it can only ever be written once per order; and the
 * order is keyed by its submission, so a resubmitted checkout never reaches
 * here twice.
 */
export function debitCheckoutRedemption(
  client: OrderLoyaltyClient,
  storeId: string,
  input: { memberId: string; orderId: string; points: number }
) {
  return appendLoyaltyLedgerEntry(
    client,
    storeId,
    loyaltyLedgerEntrySchema.parse({
      actorUserId: null,
      idempotencyKey: checkoutRedemptionKey(input.orderId),
      memberId: input.memberId,
      note: null,
      points: -input.points,
      sourceId: input.orderId,
      sourceType: "ORDER",
      type: "REDEEM"
    })
  );
}

export type LoyaltyEnrollment =
  | { action: "conflict"; memberId: string }
  | { action: "enrolled"; memberId: string }
  | { action: "existing"; memberId: string }
  | { action: "ineligible" };

/**
 * Enrols the customer a checkout just resolved, inside that checkout's
 * transaction. The caller has already checked that the shopper ticked the box
 * and that the programme is live; nothing here reads a form.
 *
 * `enrolledAt` is the order's own `createdAt`, so the order that carried the
 * opt-in is the first one that counts and every order before it is not.
 *
 * The insert skips duplicates rather than raising them. A unique violation
 * inside an interactive transaction aborts it, and two checkouts on one
 * number racing to enrol must not cost either shopper their order — so the
 * loser inserts nothing, reads back who won, and reports a conflict if the
 * winner was a different customer. Neither membership is touched.
 */
export async function enrollLoyaltyMember(
  client: Pick<Prisma.TransactionClient, "loyaltyMember">,
  input: { customerId: string; enrolledAt: Date; phone: string; storeId: string }
): Promise<LoyaltyEnrollment> {
  const byCustomer = await findMemberForCustomer(client, input.storeId, input.customerId);
  const link = decideMemberLink({
    byCustomer,
    byPhone: byCustomer ? null : await findMemberByPhone(client, input.storeId, input.phone),
    customerId: input.customerId,
    phone: input.phone
  });

  if (link.action !== "create") {
    return link;
  }

  await client.loyaltyMember.createMany({
    data: [
      {
        customerId: input.customerId,
        enrolledAt: input.enrolledAt,
        phoneKey: link.phoneKey,
        storeId: input.storeId
      }
    ],
    skipDuplicates: true
  });

  const enrolled = await findMemberForCustomer(client, input.storeId, input.customerId);

  if (enrolled) {
    return { action: "enrolled", memberId: enrolled.id };
  }

  const owner = await client.loyaltyMember.findFirst({
    select: {
      customerId: true,
      id: true
    },
    where: {
      phoneKey: link.phoneKey,
      storeId: input.storeId
    }
  });

  return owner ? { action: "conflict", memberId: owner.id } : { action: "ineligible" };
}

function findMemberForCustomer(
  client: Pick<Prisma.TransactionClient, "loyaltyMember">,
  storeId: string,
  customerId: string
) {
  return client.loyaltyMember.findFirst({
    select: {
      id: true
    },
    where: {
      customerId,
      storeId
    }
  });
}

function findMemberByPhone(
  client: Pick<Prisma.TransactionClient, "loyaltyMember">,
  storeId: string,
  phone: string
) {
  const phoneKey = loyaltyPhoneKey(phone);

  return phoneKey
    ? client.loyaltyMember.findFirst({
        select: {
          customerId: true,
          id: true
        },
        where: {
          phoneKey,
          storeId
        }
      })
    : null;
}
