import { prisma, type Prisma } from "@dash/db";
import type { AbandonedCartStage } from "./abandoned-cart.types";

export type AbandonedCartSnapshotInput = {
  itemCount: number;
  items: Prisma.InputJsonValue;
  note: string;
  storeId: string;
  subtotalAmount: string;
  token: string;
};

export type AbandonedCartStageQuery = {
  from: AbandonedCartStage[];
  storeId: string;
  to: AbandonedCartStage;
  token: string;
};

export type AbandonedCartListQuery = {
  cutoff: Date;
  dateRange?: string | undefined;
  limit?: number | undefined;
  search?: string | undefined;
  storeId: string;
};

/**
 * Mirrors the current cart cookie.
 *
 * Only the cart-shaped columns move on update: `status`, the captured contact
 * details and the recovery bookkeeping all survive a shopper editing their cart
 * after the seller has already reached out.
 */
export async function upsertAbandonedCartSnapshot(input: AbandonedCartSnapshotInput) {
  return prisma.abandonedCart.upsert({
    where: {
      storeId_token: {
        storeId: input.storeId,
        token: input.token
      }
    },
    update: {
      itemCount: input.itemCount,
      items: input.items,
      lastActivityAt: new Date(),
      note: input.note || null,
      subtotalAmount: input.subtotalAmount
    },
    create: {
      itemCount: input.itemCount,
      items: input.items,
      lastActivityAt: new Date(),
      note: input.note || null,
      status: "NOT_CONTACTED",
      storeId: input.storeId,
      subtotalAmount: input.subtotalAmount,
      token: input.token
    },
    select: {
      id: true
    }
  });
}

/**
 * Drops a snapshot the shopper resolved themselves (emptied cart, cleared cart,
 * or a checkout that completed before the cart was ever abandoned).
 *
 * Recovered rows are kept: they are the recovery history the report reads.
 */
export async function deleteActiveAbandonedCart(storeId: string, token: string) {
  return prisma.abandonedCart.deleteMany({
    where: {
      recoveredAt: null,
      storeId,
      token
    }
  });
}

export async function findAbandonedCartByToken(storeId: string, token: string) {
  return prisma.abandonedCart.findUnique({
    where: {
      storeId_token: {
        storeId,
        token
      }
    }
  });
}

/**
 * Writes what the shopper had typed onto the snapshot for their cart.
 *
 * Takes a Prisma payload rather than a fixed shape because two callers write
 * overlapping subsets of the same columns — the checkout page as it is filled
 * in, and the order attempt that follows it.
 */
export async function updateAbandonedCartCheckoutDraft(
  storeId: string,
  token: string,
  // The unchecked variant because `customerId` is a relation key, and matching
  // a guest onto an existing customer row is half of what this write is for.
  data: Prisma.AbandonedCartUncheckedUpdateManyInput
) {
  return prisma.abandonedCart.updateMany({
    where: {
      storeId,
      token
    },
    data
  });
}

/**
 * Moves a snapshot forward through the funnel, and only forward.
 *
 * The stage a shopper reached is a fact about them, so a shopper who was
 * refused at Place Order and then goes back to editing the form must not have
 * that refusal quietly downgraded to "still typing" by the next keystroke —
 * which is exactly what an unconditional write would do.
 */
export async function promoteAbandonedCartStage(query: AbandonedCartStageQuery) {
  return prisma.abandonedCart.updateMany({
    where: {
      stage: {
        in: query.from
      },
      storeId: query.storeId,
      token: query.token
    },
    data: {
      stage: query.to
    }
  });
}

export async function updateAbandonedCartStatus(
  storeId: string,
  cartId: string,
  data: Prisma.AbandonedCartUpdateManyMutationInput
) {
  return prisma.abandonedCart.updateMany({
    where: {
      id: cartId,
      storeId
    },
    data
  });
}

export async function markAbandonedCartRecovered(
  storeId: string,
  token: string,
  order: { id: string; orderNumber: string }
) {
  return prisma.abandonedCart.updateMany({
    where: {
      storeId,
      token
    },
    data: {
      recoveredAt: new Date(),
      recoveredOrderId: order.id,
      recoveredOrderNumber: order.orderNumber,
      status: "RECOVERED"
    }
  });
}

/**
 * Every cart a seller should still act on: anything quiet for longer than the
 * inactivity window, plus everything already contacted or recovered so the
 * outreach history does not disappear when a shopper comes back.
 */
export async function getAbandonedCartRecords(query: AbandonedCartListQuery) {
  return prisma.abandonedCart.findMany({
    where: {
      AND: [
        { stage: "CART" },
        {
          OR: [{ lastActivityAt: { lte: query.cutoff } }, { status: { not: "NOT_CONTACTED" } }]
        },
        ...filterConditions(query)
      ],
      storeId: query.storeId
    },
    orderBy: { lastActivityAt: "desc" },
    ...(query.limit ? { take: query.limit } : {}),
    select: {
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      id: true,
      itemCount: true,
      items: true,
      lastActivityAt: true,
      status: true,
      subtotalAmount: true,
      token: true
    }
  });
}

/**
 * Every checkout a seller should still chase.
 *
 * A refused attempt is urgent from the second it happens, so unlike a cart it
 * is listed without waiting out the inactivity window — the shopper is very
 * probably still on the page. One that is only half typed does wait, or the
 * list would fill with people who are mid-checkout right now. Anything already
 * contacted or recovered stays regardless, so outreach history does not vanish.
 */
export async function getIncompleteOrderRecords(query: AbandonedCartListQuery) {
  return prisma.abandonedCart.findMany({
    where: {
      AND: [
        { stage: { not: "CART" } },
        {
          OR: [
            { stage: "CHECKOUT_FAILED" },
            { lastActivityAt: { lte: query.cutoff } },
            { status: { not: "NOT_CONTACTED" } }
          ]
        },
        ...filterConditions(query)
      ],
      storeId: query.storeId
    },
    orderBy: { lastActivityAt: "desc" },
    ...(query.limit ? { take: query.limit } : {}),
    select: {
      addressLine1: true,
      addressLine2: true,
      area: true,
      attemptCount: true,
      city: true,
      country: true,
      couponCode: true,
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      district: true,
      failedAt: true,
      failureCode: true,
      failureReason: true,
      id: true,
      ipAddress: true,
      itemCount: true,
      items: true,
      lastActivityAt: true,
      paymentMethod: true,
      postalCode: true,
      stage: true,
      status: true,
      subtotalAmount: true,
      token: true
    }
  });
}

/**
 * One incomplete order, by row id rather than by cart token.
 *
 * The token is the shopper's; the id is what the dashboard has a handle on. A
 * seller converting a checkout into an order is working from a table row, so
 * this is the read that backs it — scoped by store like every other, so one
 * tenant cannot open another's draft by guessing an id.
 */
export async function findIncompleteOrderById(storeId: string, id: string) {
  return prisma.abandonedCart.findFirst({
    where: {
      id,
      stage: { not: "CART" },
      storeId
    },
    select: {
      addressLine1: true,
      addressLine2: true,
      area: true,
      city: true,
      country: true,
      couponCode: true,
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      district: true,
      id: true,
      items: true,
      note: true,
      paymentMethod: true,
      postalCode: true,
      shippingRateId: true,
      status: true
    }
  });
}

/** The seller-typed search box and date range, shared by both lists. */
function filterConditions(query: AbandonedCartListQuery): Prisma.AbandonedCartWhereInput[] {
  const conditions: Prisma.AbandonedCartWhereInput[] = [];
  const search = query.search?.trim();
  const activityRange = parseDateRange(query.dateRange);

  if (search) {
    conditions.push({
      OR: [
        { customerName: { contains: search, mode: "insensitive" } },
        { customerEmail: { contains: search, mode: "insensitive" } },
        { customerPhone: { contains: search, mode: "insensitive" } }
      ]
    });
  }

  if (activityRange) {
    conditions.push({ lastActivityAt: activityRange });
  }

  return conditions;
}

/**
 * The abandoned-cart report's rows: carts only.
 *
 * Scoped to the same stage its dashboard is, so the report and the page it
 * reports on can never disagree about how many there are — which is the whole
 * reason a seller trusts either of them.
 */
export async function getAbandonedCartReportRecords(storeId: string, start: Date, cutoff: Date) {
  return prisma.abandonedCart.findMany({
    where: {
      AND: [
        { stage: "CART" },
        { OR: [{ lastActivityAt: { lte: cutoff } }, { status: { not: "NOT_CONTACTED" } }] }
      ],
      lastActivityAt: { gte: start },
      storeId
    },
    orderBy: { lastActivityAt: "asc" },
    select: {
      contactChannel: true,
      lastActivityAt: true,
      recoveredAt: true,
      status: true,
      subtotalAmount: true
    }
  });
}

/** The same window over incomplete orders, matching their list row for row. */
export async function getIncompleteOrderReportRecords(storeId: string, start: Date, cutoff: Date) {
  return prisma.abandonedCart.findMany({
    where: {
      AND: [
        { stage: { not: "CART" } },
        {
          OR: [
            { stage: "CHECKOUT_FAILED" },
            { lastActivityAt: { lte: cutoff } },
            { status: { not: "NOT_CONTACTED" } }
          ]
        }
      ],
      lastActivityAt: { gte: start },
      storeId
    },
    orderBy: { lastActivityAt: "asc" },
    select: {
      contactChannel: true,
      failureCode: true,
      lastActivityAt: true,
      recoveredAt: true,
      stage: true,
      status: true,
      subtotalAmount: true
    }
  });
}

/**
 * Carts being shopped right now — tracked, but not yet abandoned.
 *
 * The list above deliberately hides these, so this is what tells a seller that
 * tracking is alive rather than that nothing is happening.
 */
export async function countActiveAbandonedCarts(storeId: string, cutoff: Date) {
  return prisma.abandonedCart.count({
    where: {
      lastActivityAt: { gt: cutoff },
      status: "NOT_CONTACTED",
      storeId
    }
  });
}

/**
 * Shoppers filling in the checkout form right now.
 *
 * The incomplete list holds these back until they go quiet, so this is what
 * tells a seller the difference between "nothing is happening" and "three
 * people are typing their address this minute".
 */
export async function countActiveCheckouts(storeId: string, cutoff: Date) {
  return prisma.abandonedCart.count({
    where: {
      lastActivityAt: { gt: cutoff },
      stage: "CHECKOUT_STARTED",
      status: "NOT_CONTACTED",
      storeId
    }
  });
}

/** The store's own verified custom domain, when it has one. */
export async function findPrimaryStoreDomain(storeId: string) {
  return prisma.storeDomain.findFirst({
    where: {
      storeId,
      type: "CUSTOM",
      verifiedAt: { not: null }
    },
    orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    select: { domain: true }
  });
}

export async function findCustomerIdByPhone(storeId: string, phone: string) {
  const customer = await prisma.customer.findUnique({
    where: {
      storeId_phone: {
        phone,
        storeId
      }
    },
    select: { id: true }
  });

  return customer?.id ?? null;
}

/** Matches the free-text range filter used by the admin log and payment lists. */
function parseDateRange(dateRange: string | undefined): Prisma.DateTimeFilter | undefined {
  if (!dateRange?.trim()) {
    return undefined;
  }

  const [startValue, endValue] = dateRange.split(/\s+-\s+|\s+to\s+/i).map((value) => value.trim());
  const start = startValue ? new Date(startValue) : null;
  const end = endValue ? new Date(endValue) : null;

  if (!start || Number.isNaN(start.getTime())) {
    return undefined;
  }

  if (!end || Number.isNaN(end.getTime())) {
    return {
      gte: start
    };
  }

  end.setHours(23, 59, 59, 999);

  return {
    gte: start,
    lte: end
  };
}

export type AbandonedCartListRecord = Awaited<ReturnType<typeof getAbandonedCartRecords>>[number];
export type IncompleteOrderListRecord = Awaited<
  ReturnType<typeof getIncompleteOrderRecords>
>[number];
