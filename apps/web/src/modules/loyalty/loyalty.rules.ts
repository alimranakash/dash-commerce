import { normalizeBangladeshPhone } from "../courier/courier-phone";
import type { LoyaltySourceType, LoyaltyTransactionType } from "./loyalty.schema";

/**
 * The loyalty programme's arithmetic, with nothing else in the file.
 *
 * No database, no session, no `next/*`: every rule that decides how many
 * points an order is worth, whether a ledger row is well formed, or whether a
 * balance agrees with its ledger lives here, so the dashboard preview, the
 * service and `verify-loyalty` all run the same code.
 *
 * Money is compared as **integer cents** for the reason the coupon engine
 * gives — `0.1 + 0.2` is not `0.3`, and this comparison decides whether a
 * customer gets a point.
 */

/** Largest movement one ledger row may carry. Far above any real order. */
export const LOYALTY_POINTS_MAX = 100_000_000;

/** The only order status that earns. See `isOrderEligibleForPoints`. */
export const LOYALTY_EARNING_ORDER_STATUS = "COMPLETED";

export type LoyaltyErrorCode =
  | "FORBIDDEN"
  | "IDEMPOTENCY_CONFLICT"
  | "INSUFFICIENT_POINTS"
  | "INVALID_ENTRY"
  | "MEMBER_NOT_FOUND"
  | "NOT_FOUND";

/** Thrown by the ledger. Carries a code so callers can branch without parsing. */
export class LoyaltyError extends Error {
  readonly code: LoyaltyErrorCode;

  constructor(code: LoyaltyErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "LoyaltyError";
  }
}

/** The store's standing with the programme. */
export type LoyaltyCapability = {
  /** The seller's switch. */
  enabled: boolean;
  /** The plan. */
  entitled: boolean;
  /** Both, which is the only state in which the programme runs. */
  live: boolean;
};

export function loyaltyCapability(enabled: boolean, entitled: boolean): LoyaltyCapability {
  return { enabled, entitled, live: enabled && entitled };
}

/**
 * Whether a checkout enrols its customer: an explicit yes from the shopper,
 * and a programme that is running right now. A switched-off programme, a plan
 * that does not include it, and a box nobody ticked are all a no.
 */
export function shouldEnrollAtCheckout(
  optIn: boolean | undefined,
  capability: Pick<LoyaltyCapability, "live">
) {
  return optIn === true && capability.live;
}

/** Whole cents, or `null` for anything that is not a finite amount. */
export function toCents(value: string | number): number | null {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(parsed) || (typeof value === "string" && value.trim() === "")) {
    return null;
  }

  return Math.round(parsed * 100);
}

export type LoyaltyEarningAmounts = {
  bundleDiscountAmount: string;
  /**
   * True when the order's coupon waived delivery. A FREE_SHIPPING coupon
   * stores the shipping charge in `discountAmount`, so subtracting it from the
   * goods would charge the customer's points for a delivery discount — and
   * shipping is outside the earning base in both directions.
   */
  couponCoversShipping: boolean;
  discountAmount: string;
  /** The points discount, once redemption exists. Absent until then. */
  loyaltyDiscountAmount?: string | undefined;
  /** Goods value settled back to the customer by completed returns. */
  returnedGoodsCents?: number | undefined;
  subtotalAmount: string;
};

/**
 * Net goods: the subtotal less every discount taken off the goods. Shipping
 * is not in it, neither the charge nor a discount on the charge.
 *
 * Fails closed. An amount that does not parse earns nothing rather than
 * earning on whatever part did parse, and a negative discount is read as no
 * discount — a malformed row must never be worth more points than a clean one.
 */
export function loyaltyEarningBaseCents(order: LoyaltyEarningAmounts): number {
  const subtotal = toCents(order.subtotalAmount);

  if (subtotal === null || subtotal <= 0) {
    return 0;
  }

  const discounts = [
    order.couponCoversShipping ? "0" : order.discountAmount,
    order.bundleDiscountAmount,
    order.loyaltyDiscountAmount ?? "0"
  ];
  let base = subtotal;

  for (const discount of discounts) {
    const cents = toCents(discount);

    if (cents === null) {
      return 0;
    }

    base -= Math.max(0, cents);
  }

  const returned = order.returnedGoodsCents ?? 0;

  if (!Number.isSafeInteger(returned)) {
    return 0;
  }

  return Math.max(0, base - Math.max(0, returned));
}

/**
 * Whether the order's coupon discount was a delivery discount rather than a
 * goods discount.
 *
 * Read from the coupon row, which is reliable for checkout orders: a coupon
 * that has ever been redeemed cannot be deleted. The amount is checked too — a
 * free-shipping discount can never be more than the shipping charge, so one
 * that is (a seller edited the order's discount by hand) is read as a goods
 * discount. Every doubt resolves towards fewer points, never more.
 */
export function couponCoversShipping(input: {
  couponDiscountType: string | null;
  discountAmount: string;
  shippingAmount: string;
}) {
  if (input.couponDiscountType !== "FREE_SHIPPING") {
    return false;
  }

  const discount = toCents(input.discountAmount);
  const shipping = toCents(input.shippingAmount);

  return discount !== null && shipping !== null && discount <= shipping;
}

export type LoyaltySettledReturn = {
  itemsAmount: string;
  replacementAmount: string;
  type: string;
};

/**
 * Goods value handed back by an order's **completed** returns, in cents, or
 * `null` when an amount cannot be read (the order then earns nothing).
 *
 * A RETURN or REFUND gives back its goods amount — the returned lines at their
 * sale price, or a flat refund. An EXCHANGE gives back only what the
 * replacement did not cover, and a pricier replacement earns nothing extra.
 * Line prices carry no share of the order's coupon, so a return on a
 * discounted order takes slightly more than the customer paid for those
 * lines: it can under-award, never over-award.
 */
export function returnedGoodsCents(returns: readonly LoyaltySettledReturn[]): number | null {
  let total = 0;

  for (const settled of returns) {
    const items = toCents(settled.itemsAmount);
    const replacement = toCents(settled.replacementAmount);

    if (items === null || replacement === null) {
      return null;
    }

    total += settled.type === "EXCHANGE" ? Math.max(0, items - replacement) : Math.max(0, items);
  }

  return total;
}

/**
 * Whether an order counts for a membership: only orders placed at or after the
 * opt-in. An order placed earlier never earns, whenever it completes — the
 * opt-in is attached to an order, and nothing before it is retroactive.
 */
export function orderEarnsForMember(orderCreatedAt: Date, memberEnrolledAt: Date) {
  return orderCreatedAt.getTime() >= memberEnrolledAt.getTime();
}

/**
 * Points for a net goods amount, **rounded down**: at 100 per point, 199.99
 * earns 1.
 *
 * Both sides are whole cents before anything is divided — `0.30 / 0.10` is
 * `2.9999999999999996`, and flooring that would take a point away. The
 * division itself goes through the remainder so it stays exact at any
 * magnitude a safe integer can reach.
 */
export function pointsForBase(baseCents: number, amountPerPoint: string): number {
  const per = toCents(amountPerPoint);

  if (per === null || per <= 0 || !Number.isSafeInteger(baseCents) || baseCents <= 0) {
    return 0;
  }

  return Math.min(LOYALTY_POINTS_MAX, (baseCents - (baseCents % per)) / per);
}

export type LoyaltyEligibilityFields = {
  markedFakeAt: Date | string | null;
  status: string;
  verificationStatus: string;
};

/**
 * Whether an order earns at all.
 *
 * `COMPLETED` is the seller's explicit "this sale happened". Every checkout
 * order starts `PENDING`, including the fake ones; the courier only ever
 * writes `fulfillmentStatus`; and `paymentStatus` is set by hand for cash on
 * delivery — so none of those can stand for a real sale.
 *
 * An order the seller rejected never earns, however it is marked, and
 * `markedFakeAt` is checked beside the status because it is the shop's own
 * record that the purchase did not happen.
 */
export function isOrderEligibleForPoints(order: LoyaltyEligibilityFields) {
  return (
    order.status === LOYALTY_EARNING_ORDER_STATUS &&
    order.verificationStatus !== "FAKE" &&
    order.verificationStatus !== "BLOCKED" &&
    order.markedFakeAt === null
  );
}

/** What an order should have earned right now. Zero when it is not eligible. */
export function orderPointsTarget(
  order: LoyaltyEarningAmounts & LoyaltyEligibilityFields,
  settings: { amountPerPoint: string }
) {
  return isOrderEligibleForPoints(order)
    ? pointsForBase(loyaltyEarningBaseCents(order), settings.amountPerPoint)
    : 0;
}

export type LoyaltyLedgerLine = {
  points: number;
  type: LoyaltyTransactionType;
};

const EARN_TYPES: ReadonlySet<LoyaltyTransactionType> = new Set(["EARN", "EARN_REVERSAL"]);

export type LoyaltyLedgerKeyPurpose = "adjust" | "earn" | "redeem" | "redeem-reversal";

/**
 * The idempotency key for one ledger write. The only spelling the ledger
 * accepts — `loyaltyLedgerEntrySchema` refuses anything else — so no caller
 * can pass a key it made up.
 */
export function loyaltyLedgerKey(parts: {
  purpose: LoyaltyLedgerKeyPurpose;
  sequence: number;
  sourceId: string;
  sourceType: LoyaltySourceType;
}) {
  return `${parts.sourceType.toLowerCase()}:${parts.sourceId}:${parts.purpose}:${parts.sequence}`;
}

export type LoyaltyEarnCorrection = {
  idempotencyKey: string;
  points: number;
  sourceId: string;
  sourceType: "ORDER";
  type: "EARN" | "EARN_REVERSAL";
};

/**
 * The row that brings an order's earned points to `target`, or `null` when
 * they are already there.
 *
 * Reconciling to a target rather than reacting to events is what makes order
 * status safe to move in both directions: Completed → Cancelled → Completed
 * writes +n, −n, +n, and the same event arriving twice writes nothing the
 * second time. Redemption rows on the same order are not counted — what was
 * spent is not what was earned.
 *
 * The key's sequence is the number of earn rows already written for the
 * order. Two copies of one event read the same history and so produce the
 * same key, and the ledger's unique index lets exactly one of them land; a
 * genuine later change reads a longer history and gets a new key.
 */
export function earnCorrection(
  orderId: string,
  target: number,
  lines: readonly LoyaltyLedgerLine[]
): LoyaltyEarnCorrection | null {
  if (!Number.isSafeInteger(target) || target < 0) {
    throw new LoyaltyError("INVALID_ENTRY", "An order's points target must be a whole number.");
  }

  const earnLines = lines.filter((line) => EARN_TYPES.has(line.type));
  const applied = earnLines.reduce((sum, line) => sum + line.points, 0);
  const delta = target - applied;

  if (delta === 0) {
    return null;
  }

  return {
    idempotencyKey: loyaltyLedgerKey({
      purpose: "earn",
      sequence: earnLines.length,
      sourceId: orderId,
      sourceType: "ORDER"
    }),
    points: delta,
    sourceId: orderId,
    sourceType: "ORDER",
    type: delta > 0 ? "EARN" : "EARN_REVERSAL"
  };
}

/** What reconciling an order needs to know about the store, read before its transaction. */
export type OrderLoyaltyContext = {
  /** The current spend per point, for an order that has not earned before. */
  amountPerPoint: string;
  /** The seller's switch and the plan, together. */
  live: boolean;
};

export type OrderLoyaltyFacts = {
  coupon: { discountType: string } | null;
  /** The order's own ledger rows, oldest first. */
  lines: readonly (LoyaltyLedgerLine & { amountPerPoint: string | null; memberId: string })[];
  /**
   * The membership the order earns for: the one its rows already name, or
   * with no rows yet, the customer's.
   */
  member: { enrolledAt: Date; id: string; suspendedAt: Date | null } | null;
  order: LoyaltyEligibilityFields & {
    bundleDiscountAmount: string;
    createdAt: Date;
    discountAmount: string;
    id: string;
    /** What redeemed points took off the order; it does not earn. */
    loyaltyDiscountAmount?: string | undefined;
    shippingAmount: string;
    subtotalAmount: string;
  };
  /** The order's completed returns, exchanges and refunds. */
  returns: readonly LoyaltySettledReturn[];
};

export type OrderLoyaltyPlan =
  | { action: "none"; reason: "already-reconciled" | "no-member" | "not-live" | "suspended" }
  | {
      action: "write";
      amountPerPoint: string;
      correction: LoyaltyEarnCorrection;
      memberId: string;
    };

/**
 * The one decision every order lifecycle hook makes: given the order as it
 * now stands and what its ledger already says, what row — if any — brings
 * them into agreement.
 *
 * - The member is whoever the order already earned for. With no rows yet, it
 *   is the customer's membership, and only if the order was placed at or after
 *   the opt-in.
 * - The rate is whatever the order first earned at; the current setting only
 *   prices an order that has never earned.
 * - While the programme is not live nothing new is earned, but a correction
 *   downwards — a cancellation, a refund, an order marked fake — still lands,
 *   so a balance never keeps points for a sale that did not stand. A suspended
 *   membership is the same rule for one member.
 */
export function planOrderLoyalty(
  facts: OrderLoyaltyFacts,
  context: OrderLoyaltyContext
): OrderLoyaltyPlan {
  const { order } = facts;
  const recordedMember = facts.lines[0]?.memberId ?? null;
  const memberId =
    recordedMember ??
    (facts.member && orderEarnsForMember(order.createdAt, facts.member.enrolledAt)
      ? facts.member.id
      : null);

  if (!memberId) {
    return { action: "none", reason: "no-member" };
  }

  const amountPerPoint =
    facts.lines.find((line) => line.amountPerPoint !== null)?.amountPerPoint ??
    context.amountPerPoint;
  const returned = returnedGoodsCents(facts.returns);
  const base =
    returned !== null && isOrderEligibleForPoints(order)
      ? loyaltyEarningBaseCents({
          bundleDiscountAmount: order.bundleDiscountAmount,
          couponCoversShipping: couponCoversShipping({
            couponDiscountType: facts.coupon?.discountType ?? null,
            discountAmount: order.discountAmount,
            shippingAmount: order.shippingAmount
          }),
          discountAmount: order.discountAmount,
          loyaltyDiscountAmount: order.loyaltyDiscountAmount,
          returnedGoodsCents: returned,
          subtotalAmount: order.subtotalAmount
        })
      : 0;
  const correction = earnCorrection(order.id, pointsForBase(base, amountPerPoint), facts.lines);

  if (!correction) {
    return { action: "none", reason: "already-reconciled" };
  }

  if (correction.points > 0 && !context.live) {
    return { action: "none", reason: "not-live" };
  }

  if (correction.points > 0 && facts.member?.id === memberId && facts.member.suspendedAt !== null) {
    return { action: "none", reason: "suspended" };
  }

  return { action: "write", amountPerPoint, correction, memberId };
}

/* -------------------------------------------------------------------------- */
/* Offline sales                                                              */
/* -------------------------------------------------------------------------- */

export const LOYALTY_EARNING_SALE_STATUS = "COMPLETED";
export const LOYALTY_EARNING_SALE_PAYMENT_STATUS = "PAID";

/**
 * Whether an offline sale has happened and been paid for in full. Both are the
 * seller's own marks — the status is chosen on the form, the payment status is
 * worked out from the amount paid — so a partly paid or unpaid sale earns
 * nothing until it is settled, and a cancelled or returned one nothing at all.
 */
export function isSaleEligibleForPoints(sale: { paymentStatus: string; status: string }) {
  return (
    sale.status === LOYALTY_EARNING_SALE_STATUS &&
    sale.paymentStatus === LOYALTY_EARNING_SALE_PAYMENT_STATUS
  );
}

/**
 * Whether a sale counts for a membership. Nothing before the member joined is
 * retroactive, measured both ways a sale is dated: when it was recorded, and
 * the day staff typed in, which can be earlier. `saleDate` is a calendar day
 * at local midnight, so it is compared with the day the member joined.
 */
export function saleEarnsForMember(
  sale: { createdAt: Date; saleDate: Date },
  memberEnrolledAt: Date
) {
  const joinedDay = new Date(
    memberEnrolledAt.getFullYear(),
    memberEnrolledAt.getMonth(),
    memberEnrolledAt.getDate()
  );

  return (
    orderEarnsForMember(sale.createdAt, memberEnrolledAt) &&
    sale.saleDate.getTime() >= joinedDay.getTime()
  );
}

/**
 * What a save does to a sale's recorded opt-in.
 *
 * `in` and `out` are the box the form showed, ticked or not. `keep` is what an
 * edit sends when the form did not show it — no eligible member chosen, or no
 * programme running — and the record then stands, unless the sale now has a
 * different customer: consent is the customer's, and nobody asked the new one.
 */
export function resolveSaleOptIn(input: {
  choice: "in" | "keep" | "out";
  customerId: string | null;
  existing: { customerId: string } | null;
}): "record" | "remove" | "unchanged" {
  if (input.choice === "in") {
    return "record";
  }

  if (!input.existing) {
    return "unchanged";
  }

  return input.choice === "out" || input.existing.customerId !== input.customerId
    ? "remove"
    : "unchanged";
}

export type SaleEarnCorrection = {
  idempotencyKey: string;
  points: number;
  sourceId: string;
  sourceType: "SALE";
  type: "EARN" | "EARN_REVERSAL";
};

export type SaleLoyaltyFacts = {
  /** The sale's own ledger rows, oldest first. */
  lines: readonly (LoyaltyLedgerLine & { amountPerPoint: string | null; memberId: string })[];
  /** The membership, in this store, of the customer the sale is for now. */
  member: { customerId: string; enrolledAt: Date; id: string; suspendedAt: Date | null } | null;
  /** The opt-in recorded for the sale, naming the customer who gave it. */
  optIn: { customerId: string } | null;
  sale: {
    createdAt: Date;
    customerId: string | null;
    /** The sale-level discount. Line discounts are already out of `subtotal`. */
    discount: string;
    id: string;
    paymentStatus: string;
    saleDate: Date;
    status: string;
    /** Goods after line discounts — tax and shipping are not in it. */
    subtotal: string;
  };
};

export type SaleLoyaltyWrite = {
  amountPerPoint: string;
  correction: SaleEarnCorrection;
  memberId: string;
};

export type SaleLoyaltyPlan = {
  /** Why the earning member was not credited further, when they were not. */
  held: "not-live" | "suspended" | null;
  writes: SaleLoyaltyWrite[];
};

/**
 * Every sale lifecycle hook's one decision — the sale counterpart of
 * `planOrderLoyalty`, built from the same parts: the same net-goods base, the
 * same rounding down, the rate the sale first earned at, and the same rule
 * that a programme switched off or a suspended membership stops new points but
 * never a correction downwards.
 *
 * Two things differ because a sale is edited by hand. Earning needs the
 * customer's own opt-in for this sale, given by the customer the sale is for
 * now. And that customer can be changed, so the sale reconciles per member:
 * anyone it credited who is no longer its earning member goes back to zero
 * first, and only then is the current one brought to target — points are
 * never left with the wrong person.
 *
 * Key sequences count every earn row the sale has written, so two copies of
 * one save read the same history, produce the same keys, and the ledger lets
 * exactly one of them land.
 */
export function planSaleLoyalty(
  facts: SaleLoyaltyFacts,
  context: OrderLoyaltyContext
): SaleLoyaltyPlan {
  const { member, sale } = facts;
  const earnLines = facts.lines.filter((line) => EARN_TYPES.has(line.type));
  const netByMember = new Map<string, number>();

  for (const line of earnLines) {
    netByMember.set(line.memberId, (netByMember.get(line.memberId) ?? 0) + line.points);
  }

  const earningMember =
    member &&
    sale.customerId !== null &&
    member.customerId === sale.customerId &&
    facts.optIn?.customerId === sale.customerId &&
    saleEarnsForMember(sale, member.enrolledAt)
      ? member
      : null;
  const amountPerPoint =
    facts.lines.find((line) => line.amountPerPoint !== null)?.amountPerPoint ??
    context.amountPerPoint;
  const target =
    earningMember && isSaleEligibleForPoints(sale)
      ? pointsForBase(
          loyaltyEarningBaseCents({
            bundleDiscountAmount: "0",
            couponCoversShipping: false,
            discountAmount: sale.discount,
            subtotalAmount: sale.subtotal
          }),
          amountPerPoint
        )
      : 0;
  const writes: SaleLoyaltyWrite[] = [];
  let sequence = earnLines.length;
  const write = (memberId: string, points: number) => {
    writes.push({
      amountPerPoint,
      correction: {
        idempotencyKey: loyaltyLedgerKey({
          purpose: "earn",
          sequence,
          sourceId: sale.id,
          sourceType: "SALE"
        }),
        points,
        sourceId: sale.id,
        sourceType: "SALE",
        type: points > 0 ? "EARN" : "EARN_REVERSAL"
      },
      memberId
    });
    sequence += 1;
  };

  // Only ever downwards: a member the sale no longer earns for is never
  // credited by it, even if their rows somehow net below zero.
  for (const [memberId, net] of netByMember) {
    if (memberId !== earningMember?.id && net > 0) {
      write(memberId, -net);
    }
  }

  let held: SaleLoyaltyPlan["held"] = null;

  if (earningMember) {
    const delta = target - (netByMember.get(earningMember.id) ?? 0);

    if (delta > 0 && !context.live) {
      held = "not-live";
    } else if (delta > 0 && earningMember.suspendedAt !== null) {
      held = "suspended";
    } else if (delta !== 0) {
      write(earningMember.id, delta);
    }
  }

  return { held, writes };
}

/* -------------------------------------------------------------------------- */
/* Redemption                                                                 */
/* -------------------------------------------------------------------------- */

export type RedemptionPolicy = {
  /** Whole percent of the discounted goods points may cover. */
  maxRedeemPercent: number;
  minRedeemPoints: number;
  /** What one point is worth, as a money string. */
  pointValue: string;
};

export type RedemptionLimits = {
  /** False when this order cannot take even the minimum. */
  available: boolean;
  maxPoints: number;
  minPoints: number;
  pointValueCents: number;
};

/** Whether members may spend points right now: the programme, the plan and its own switch. */
export function loyaltyRedemptionLive(
  capability: Pick<LoyaltyCapability, "live">,
  redemptionEnabled: boolean
) {
  return capability.live && redemptionEnabled;
}

/**
 * The most points this order can take: the smaller of what the member holds
 * and what the cap allows, the cap being a share of the goods after bundle and
 * coupon discounts. Shipping is never in it, so points can never pay for
 * delivery.
 *
 * Every step is whole cents and remainder division, for the same reason
 * `pointsForBase` gives: a rounding error here is money.
 */
export function redemptionLimits(input: {
  balance: number;
  eligibleGoodsCents: number;
  policy: RedemptionPolicy;
}): RedemptionLimits {
  const pointValueCents = toCents(input.policy.pointValue) ?? 0;
  const minPoints = Math.max(1, Math.floor(input.policy.minRedeemPoints));
  const percent = Math.min(100, Math.max(0, Math.floor(input.policy.maxRedeemPercent)));
  const goods = input.eligibleGoodsCents;

  if (
    pointValueCents <= 0 ||
    !Number.isSafeInteger(goods) ||
    goods <= 0 ||
    !Number.isSafeInteger(input.balance)
  ) {
    return { available: false, maxPoints: 0, minPoints, pointValueCents };
  }

  const capCents = (goods * percent - ((goods * percent) % 100)) / 100;
  const byCap = (capCents - (capCents % pointValueCents)) / pointValueCents;
  const maxPoints = Math.max(0, Math.min(input.balance, byCap));

  return { available: maxPoints >= minPoints, maxPoints, minPoints, pointValueCents };
}

export type RedemptionCheck =
  | { discountCents: number; ok: true; points: number }
  | { message: string; ok: false };

/**
 * Whether a shopper may redeem exactly `requested` points on this order, and
 * what that takes off. The points are the shopper's choice; the discount never
 * is — it is always the points times the store's own value.
 */
export function checkRedemption(requested: number, limits: RedemptionLimits): RedemptionCheck {
  if (!Number.isSafeInteger(requested) || requested <= 0) {
    return { message: "Enter a whole number of points to use.", ok: false };
  }

  if (!limits.available) {
    return {
      message:
        limits.maxPoints > 0
          ? `This order can take at most ${limits.maxPoints} points, below the ${limits.minPoints}-point minimum.`
          : "Points can't be used on this order.",
      ok: false
    };
  }

  if (requested < limits.minPoints) {
    return { message: `Use at least ${limits.minPoints} points.`, ok: false };
  }

  if (requested > limits.maxPoints) {
    return { message: `You can use at most ${limits.maxPoints} points on this order.`, ok: false };
  }

  return { discountCents: requested * limits.pointValueCents, ok: true, points: requested };
}

const REDEEM_TYPES: ReadonlySet<LoyaltyTransactionType> = new Set(["REDEEM", "REDEEM_REVERSAL"]);

export type LoyaltyRedeemCorrection = {
  idempotencyKey: string;
  points: number;
  sourceId: string;
  sourceType: "ORDER";
  type: "REDEEM" | "REDEEM_REVERSAL";
};

export type OrderRedemptionPlan =
  | { action: "none"; reason: "already-reconciled" | "no-redemption" }
  | { action: "write"; correction: LoyaltyRedeemCorrection; memberId: string };

/**
 * The points an order spent, brought into line with the order as it stands:
 * all of them while it stands, none once it is cancelled.
 *
 * The amount is fixed by the first REDEEM row, the checkout's own debit, so
 * nothing can raise it afterwards. Cancelling writes it back once; completing
 * again spends it again, which the ledger refuses if the balance no longer
 * covers it. Returns and refunds do not touch it — they are settled in cash at
 * line price, as a coupon's share is. And unlike earning, neither the
 * programme being off nor a suspension holds this back: giving spent points
 * back for a sale that did not happen is restitution, not a reward.
 */
export function planOrderRedemption(
  facts: Pick<OrderLoyaltyFacts, "lines" | "order">
): OrderRedemptionPlan {
  const original = facts.lines.find((line) => line.type === "REDEEM");

  if (!original) {
    return { action: "none", reason: "no-redemption" };
  }

  const redeemLines = facts.lines.filter((line) => REDEEM_TYPES.has(line.type));
  const target = facts.order.status === "CANCELLED" ? 0 : -original.points;
  const spent = -redeemLines.reduce((sum, line) => sum + line.points, 0);
  const delta = target - spent;

  if (delta === 0) {
    return { action: "none", reason: "already-reconciled" };
  }

  return {
    action: "write",
    correction: {
      idempotencyKey: loyaltyLedgerKey({
        purpose: "redeem",
        sequence: redeemLines.length,
        sourceId: facts.order.id,
        sourceType: "ORDER"
      }),
      points: -delta,
      sourceId: facts.order.id,
      sourceType: "ORDER",
      type: delta > 0 ? "REDEEM" : "REDEEM_REVERSAL"
    },
    memberId: original.memberId
  };
}

/**
 * What an order's points did, in one sentence for the order page — so the
 * points discount is never read as money refunded, and a seller can see
 * whether a cancellation has already given them back.
 */
export function describeOrderPoints(lines: readonly LoyaltyLedgerLine[]) {
  const original = lines.find((line) => line.type === "REDEEM");

  if (!original) {
    return null;
  }

  const redeemed = -original.points;
  const stillSpent = -lines
    .filter((line) => REDEEM_TYPES.has(line.type))
    .reduce((sum, line) => sum + line.points, 0);

  if (stillSpent === 0) {
    return `${redeemed.toLocaleString("en")} points were given back when the order was cancelled.`;
  }

  return `Paid with ${stillSpent.toLocaleString("en")} points. Cancelling the order gives them back; returns and refunds are settled in cash and do not.`;
}

/** The key of an order's own checkout debit — the first redeem row it ever has. */
export function checkoutRedemptionKey(orderId: string) {
  return loyaltyLedgerKey({
    purpose: "redeem",
    sequence: 0,
    sourceId: orderId,
    sourceType: "ORDER"
  });
}

/** Largest manual adjustment, either way: 100,000 points is ৳1 crore of spend at the default rate. */
export const LOYALTY_ADJUSTMENT_MAX = 100_000;

export type LoyaltyMemberAction =
  | "add-points"
  | "deduct-points"
  | "resolve-conflict"
  | "resume"
  | "suspend";

/**
 * Which member actions need the plan. The entitlement buys authoring — adding
 * points, putting a membership back into service — while everything that
 * stops or takes away stays open, so a store whose plan has lapsed can still
 * pull points back, suspend a member and clear its conflicts.
 */
export function memberActionNeedsPlan(action: LoyaltyMemberAction) {
  return action === "add-points" || action === "resume";
}

/**
 * A page read with one row of look-ahead: `take: size + 1`, so the extra row
 * says whether another page exists without a second query or a count.
 */
export function splitLookaheadPage<T>(rows: readonly T[], size: number) {
  return { hasMore: rows.length > size, page: rows.slice(0, size) };
}

export function loyaltyMembershipStatus(member: {
  suspendedAt: Date | null;
}): "ACTIVE" | "SUSPENDED" {
  return member.suspendedAt === null ? "ACTIVE" : "SUSPENDED";
}

/**
 * The digits a member search can match against a stored `phoneKey`, or null
 * when the query holds too few to mean a number.
 *
 * Folded the way `loyaltyPhoneKey` folds a whole number — the `880` country
 * code and the leading zero dropped — so "+8801712", "01712" and "1712" all
 * find `01712345678`, while a name with a digit or two in it does not.
 */
export function loyaltyPhoneSearchDigits(query: string) {
  let digits = query.replace(/\D/g, "");

  if (digits.startsWith("880")) {
    digits = digits.slice(3);
  }

  digits = digits.replace(/^0+/, "");

  return digits.length >= 3 ? digits : null;
}

/** The sign each type must carry. ADJUSTMENT may go either way. */
const REQUIRED_SIGN: Record<LoyaltyTransactionType, -1 | 0 | 1> = {
  ADJUSTMENT: 0,
  EARN: 1,
  EARN_REVERSAL: -1,
  REDEEM: -1,
  REDEEM_REVERSAL: 1
};

/** Why a ledger row is malformed, or `null` when it is not. */
export function ledgerEntryProblem(entry: {
  points: number;
  sourceId: string | null;
  sourceType: LoyaltySourceType;
  type: LoyaltyTransactionType;
}): string | null {
  if (!Number.isSafeInteger(entry.points) || entry.points === 0) {
    return "Points must be a whole number other than zero.";
  }

  if (Math.abs(entry.points) > LOYALTY_POINTS_MAX) {
    return `One entry cannot move more than ${LOYALTY_POINTS_MAX} points.`;
  }

  const sign = REQUIRED_SIGN[entry.type];

  if (sign !== 0 && Math.sign(entry.points) !== sign) {
    return `${entry.type} must ${sign > 0 ? "add" : "subtract"} points.`;
  }

  if (!ALLOWED_SOURCES[entry.type].includes(entry.sourceType)) {
    return `${entry.type} cannot come from a ${entry.sourceType} source.`;
  }

  if (entry.sourceType === "ORDER" && !entry.sourceId) {
    return "An order entry must name its order.";
  }

  if (entry.sourceType === "SALE" && !entry.sourceId) {
    return "A sale entry must name its sale.";
  }

  return null;
}

/**
 * What may answer for each type of row. A sale earns and has its earning
 * reversed; it never spends — offline redemption does not exist — and a hand
 * adjustment is only ever manual.
 */
const ALLOWED_SOURCES: Record<LoyaltyTransactionType, readonly LoyaltySourceType[]> = {
  ADJUSTMENT: ["MANUAL"],
  EARN: ["ORDER", "SALE"],
  EARN_REVERSAL: ["ORDER", "SALE"],
  REDEEM: ["ORDER"],
  REDEEM_REVERSAL: ["ORDER"]
};

/**
 * The lowest balance this row may leave behind, or `null` for no limit.
 *
 * Adding points is never refused. An earn reversal is recorded in full even
 * past zero — points already spent are owed, and a negative balance simply
 * cannot redeem. Spending, and taking points away by hand, may not go below
 * zero.
 */
export function balanceFloorFor(entry: LoyaltyLedgerLine): number | null {
  if (entry.points > 0 || entry.type === "EARN_REVERSAL") {
    return null;
  }

  return 0;
}

/** The balance a ledger adds up to. */
export function ledgerBalance(lines: readonly { points: number }[]) {
  return lines.reduce((sum, line) => sum + line.points, 0);
}

/**
 * Index of the first row whose `balanceAfter` does not follow from the row
 * before it, or -1 when the chain is whole. Rows must be in write order.
 */
export function firstBrokenLedgerLink(lines: readonly { balanceAfter: number; points: number }[]) {
  let balance = 0;

  for (const [index, line] of lines.entries()) {
    balance += line.points;

    if (line.balanceAfter !== balance) {
      return index;
    }
  }

  return -1;
}

/**
 * The key a phone number is a member under.
 *
 * A Bangladesh mobile in any of its spellings — spaces, dashes, `+880`, `880`,
 * the ten-digit form — becomes its canonical `01XXXXXXXXX`, which is what
 * makes `01712…` and `+8801712…` one member. Anything else keeps its digits
 * behind a `+`, so it can never collide with a Bangladesh key.
 *
 * It only ever folds together spellings of the *same* number. A string it
 * cannot read stays apart rather than being guessed into somebody else's
 * membership: a split balance can be merged by hand, a merged one cannot be
 * told apart again.
 */
export function loyaltyPhoneKey(phone: string | null | undefined) {
  const bangladesh = normalizeBangladeshPhone(phone);

  if (bangladesh) {
    return bangladesh;
  }

  const digits = String(phone ?? "").replace(/\D/g, "");

  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

/**
 * The number a redemption code is sent to and a token is bound to: a Bangladesh
 * mobile in its canonical form, or null. For every number it accepts it equals
 * `loyaltyPhoneKey`, so the code, the token and the membership all name one
 * key; a foreign number has a membership key but no code, so it cannot redeem —
 * failing closed rather than texting a number the gateway cannot reach.
 */
export function loyaltyOtpPhone(phone: string | null | undefined) {
  return normalizeBangladeshPhone(phone);
}

export type LoyaltyMemberLink =
  | { action: "conflict"; memberId: string }
  | { action: "create"; phoneKey: string }
  | { action: "existing"; memberId: string }
  | { action: "ineligible" };

/**
 * Which membership a customer belongs to, without ever merging two.
 *
 * A customer who already has a membership keeps it, whatever number they
 * typed this time — re-keying it would move a balance on the strength of a
 * form field. A number that already belongs to *another* customer's
 * membership is a conflict, never a link: two `Customer` rows on one number
 * may be one person or two, and only the seller can say which.
 */
export function decideMemberLink(input: {
  byCustomer: { id: string } | null;
  byPhone: { customerId: string; id: string } | null;
  customerId: string;
  phone: string;
}): LoyaltyMemberLink {
  if (input.byCustomer) {
    return { action: "existing", memberId: input.byCustomer.id };
  }

  const phoneKey = loyaltyPhoneKey(input.phone);

  if (!phoneKey) {
    return { action: "ineligible" };
  }

  if (input.byPhone) {
    return input.byPhone.customerId === input.customerId
      ? { action: "existing", memberId: input.byPhone.id }
      : { action: "conflict", memberId: input.byPhone.id };
  }

  return { action: "create", phoneKey };
}
