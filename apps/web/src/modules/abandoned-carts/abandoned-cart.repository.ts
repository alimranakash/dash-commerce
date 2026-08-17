import { prisma, type Prisma } from "@dash/db";

export type AbandonedCartSnapshotInput = {
  itemCount: number;
  items: Prisma.InputJsonValue;
  note: string;
  storeId: string;
  subtotalAmount: string;
  token: string;
};

export type AbandonedCartContactUpdate = {
  customerEmail: string | null;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
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

export async function updateAbandonedCartContact(
  storeId: string,
  token: string,
  contact: AbandonedCartContactUpdate
) {
  return prisma.abandonedCart.updateMany({
    where: {
      storeId,
      token
    },
    data: contact
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
  const conditions: Prisma.AbandonedCartWhereInput[] = [
    {
      OR: [{ lastActivityAt: { lte: query.cutoff } }, { status: { not: "NOT_CONTACTED" } }]
    }
  ];
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

  return prisma.abandonedCart.findMany({
    where: {
      AND: conditions,
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

export async function getAbandonedCartReportRecords(storeId: string, start: Date, cutoff: Date) {
  return prisma.abandonedCart.findMany({
    where: {
      OR: [{ lastActivityAt: { lte: cutoff } }, { status: { not: "NOT_CONTACTED" } }],
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
