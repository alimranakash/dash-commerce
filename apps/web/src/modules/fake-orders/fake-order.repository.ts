import { prisma } from "@dash/db";
import { ensureFakeOrderRiskSchema, getDatabaseSchemaName } from "./fake-order-risk-schema";
import { PENDING_REVIEW_STATUSES } from "./fake-order.types";
import type {
  CustomerFlagStatus,
  RiskFactor,
  RiskLevel,
  StoredVerificationStatus,
  VerificationStatus
} from "./fake-order.types";

/** Columns the review UI needs. Deliberately no items, no address rows. */
const riskListSelect = {
  createdAt: true,
  currency: true,
  customerName: true,
  customerPhone: true,
  id: true,
  orderNumber: true,
  riskLevel: true,
  riskScore: true,
  totalAmount: true,
  verificationStatus: true
} as const;

export type RiskListOrder = {
  createdAt: Date;
  currency: string;
  customerName: string;
  customerPhone: string;
  id: string;
  orderNumber: string;
  riskLevel: RiskLevel;
  riskScore: number;
  totalAmount: unknown;
  verificationStatus: StoredVerificationStatus;
};

function searchFilter(search: string) {
  const query = search.trim();

  if (!query) {
    return {};
  }

  return {
    OR: [
      { orderNumber: { contains: query, mode: "insensitive" as const } },
      { customerName: { contains: query, mode: "insensitive" as const } },
      { customerEmail: { contains: query, mode: "insensitive" as const } },
      { customerPhone: { contains: query, mode: "insensitive" as const } }
    ]
  };
}

/* -------------------------------------------------------------------------- */
/* Dashboard reads — stored risk data only                                    */
/* -------------------------------------------------------------------------- */

/**
 * `includeUndecided` widens the queue to every order that has not reached a
 * terminal decision. It is set when the store blocks courier booking until an
 * order is verified — under that policy a NORMAL order still needs the seller,
 * because nothing ships without a VERIFIED status.
 */
export async function getVerificationQueueOrders(
  storeId: string,
  search: string,
  options: { includeUndecided: boolean } = { includeUndecided: false }
) {
  await ensureFakeOrderRiskSchema();

  return prisma.order.findMany({
    where: {
      storeId,
      verificationStatus: options.includeUndecided
        ? { notIn: ["VERIFIED", "FAKE", "BLOCKED"] }
        : { in: [...PENDING_REVIEW_STATUSES] },
      ...searchFilter(search)
    },
    select: riskListSelect,
    orderBy: [{ riskScore: "desc" }, { createdAt: "desc" }]
  }) as Promise<RiskListOrder[]>;
}

export async function getRiskOrdersForFilter(
  storeId: string,
  filter: { level?: RiskLevel; verified?: boolean },
  search: string
) {
  await ensureFakeOrderRiskSchema();

  return prisma.order.findMany({
    where: {
      storeId,
      ...(filter.level ? { riskLevel: filter.level } : {}),
      ...(filter.verified ? { verificationStatus: "VERIFIED" as const } : {}),
      ...searchFilter(search)
    },
    select: riskListSelect,
    orderBy: { createdAt: "desc" }
  }) as Promise<RiskListOrder[]>;
}

/** One grouped query for the four summary tiles instead of a full table scan. */
export async function getRiskLevelCounts(storeId: string) {
  await ensureFakeOrderRiskSchema();

  const rows = await prisma.order.groupBy({
    by: ["riskLevel"],
    where: {
      storeId
    },
    _count: {
      _all: true
    }
  });

  return rows.reduce<Record<RiskLevel, number>>(
    (counts, row) => {
      counts[row.riskLevel as RiskLevel] = row._count._all;

      return counts;
    },
    { HIGH: 0, LOW: 0, MEDIUM: 0 }
  );
}

export async function countOrdersByVerificationStatus(
  storeId: string,
  statuses: readonly StoredVerificationStatus[]
) {
  await ensureFakeOrderRiskSchema();

  return prisma.order.count({
    where: {
      storeId,
      verificationStatus: {
        in: [...statuses]
      }
    }
  });
}

export async function countOrdersForStore(storeId: string) {
  return prisma.order.count({ where: { storeId } });
}

export async function countBlockedCustomers(storeId: string) {
  return prisma.customer.count({
    where: {
      flagStatus: "BLOCKED",
      storeId
    }
  });
}

export async function getRiskOrderByIdForStore(storeId: string, orderId: string) {
  await ensureFakeOrderRiskSchema();

  return prisma.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    include: {
      billingAddress: true,
      customer: true,
      items: {
        orderBy: {
          createdAt: "asc"
        }
      },
      shippingAddress: true
    }
  });
}

/**
 * Same-phone history for the review page, matched in SQL on the digits-only
 * phone so it uses the expression index instead of loading the store's orders.
 */
export async function getOrdersBySamePhone(storeId: string, phone: string, limit = 50) {
  await ensureFakeOrderRiskSchema();

  return prisma.$queryRawUnsafe<
    Array<{ createdAt: Date; id: string; orderNumber: string; status: string; totalAmount: unknown }>
  >(
    `
    SELECT "id", "orderNumber", "status", "totalAmount", "createdAt"
    FROM ${orderTable()}
    WHERE "storeId" = $1
      AND regexp_replace("customerPhone", '\\D', '', 'g') = $2
    ORDER BY "createdAt" DESC
    LIMIT $3
  `,
    storeId,
    phone,
    limit
  );
}

/* -------------------------------------------------------------------------- */
/* Assessment inputs                                                          */
/* -------------------------------------------------------------------------- */

export type RiskOrderInput = {
  customerFlagStatus: CustomerFlagStatus | null;
  customerName: string;
  customerPhone: string;
  id: string;
  paymentMethodType: string;
  shippingAddressId: string | null;
  totalAmount: unknown;
  verificationDecidedAt: Date | null;
};

export async function getRiskOrderInputs(storeId: string, orderIds: string[]) {
  await ensureFakeOrderRiskSchema();

  if (orderIds.length === 0) {
    return [];
  }

  const orders = await prisma.order.findMany({
    where: {
      id: {
        in: orderIds
      },
      storeId
    },
    select: {
      customer: {
        select: {
          flagStatus: true
        }
      },
      customerName: true,
      customerPhone: true,
      id: true,
      paymentMethodType: true,
      shippingAddressId: true,
      totalAmount: true,
      verificationDecidedAt: true
    }
  });

  return orders.map<RiskOrderInput>((order) => ({
    customerFlagStatus: (order.customer?.flagStatus ?? null) as CustomerFlagStatus | null,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    id: order.id,
    paymentMethodType: order.paymentMethodType,
    shippingAddressId: order.shippingAddressId,
    totalAmount: order.totalAmount,
    verificationDecidedAt: order.verificationDecidedAt
  }));
}

export type PhoneRiskSignalRow = {
  cancelledOrderCount: number;
  duplicateOrderCount: number;
  fakeOrderCount: number;
  orderId: string;
  recentOrderCount: number;
  samePhoneOrderCount: number;
};

/**
 * The whole per-phone history collapsed into one aggregate, for a batch of
 * orders at a time.
 *
 * This is what replaced loading every order in the store and doing an O(n²)
 * phone comparison in memory: each target order is joined to its own phone group
 * through the digits-only expression index, and the counts the rules need come
 * back as counts. `recentOrderCount` and `duplicateOrderCount` stay correlated
 * to each order's own `createdAt` and `totalAmount`, which is why this is a
 * join rather than a plain GROUP BY.
 */
export async function getPhoneRiskSignals(storeId: string, orderIds: string[]) {
  await ensureFakeOrderRiskSchema();

  if (orderIds.length === 0) {
    return [];
  }

  // Positional placeholders rather than an array parameter: every other raw
  // query in the codebase passes plain scalars, and the batch size keeps this
  // far below Postgres' parameter ceiling.
  const idPlaceholders = orderIds.map((_, index) => `$${index + 2}`).join(", ");

  return prisma.$queryRawUnsafe<PhoneRiskSignalRow[]>(
    `
    WITH target AS (
      SELECT "id", "createdAt", "totalAmount",
             regexp_replace("customerPhone", '\\D', '', 'g') AS phone
      FROM ${orderTable()}
      WHERE "storeId" = $1 AND "id" IN (${idPlaceholders})
    )
    SELECT
      target."id" AS "orderId",
      COUNT(sibling."id")::int AS "samePhoneOrderCount",
      COUNT(sibling."id") FILTER (WHERE sibling."status" = 'CANCELLED')::int AS "cancelledOrderCount",
      COUNT(sibling."id") FILTER (
        WHERE sibling."verificationStatus" IN ('FAKE', 'BLOCKED')
      )::int AS "fakeOrderCount",
      COUNT(sibling."id") FILTER (
        WHERE sibling."createdAt" >= target."createdAt" - INTERVAL '1 hour'
          AND sibling."createdAt" <= target."createdAt" + INTERVAL '1 hour'
      )::int AS "recentOrderCount",
      -- The twin, if there is one: same phone, same total, same few hours, and
      -- not the order itself. Six hours rather than one because the mechanical
      -- repeats are stopped upstream now — what reaches here is a person or a
      -- seller entering the same order twice, which takes longer than a
      -- double tap. A cancelled sibling is excluded so that resolving a pair
      -- clears the flag off the one that is left.
      COUNT(sibling."id") FILTER (
        WHERE sibling."id" <> target."id"
          AND sibling."totalAmount" = target."totalAmount"
          AND sibling."status" <> 'CANCELLED'
          AND sibling."createdAt" >= target."createdAt" - INTERVAL '6 hours'
          AND sibling."createdAt" <= target."createdAt" + INTERVAL '6 hours'
      )::int AS "duplicateOrderCount"
    FROM target
    LEFT JOIN ${orderTable()} sibling
      ON sibling."storeId" = $1
     AND regexp_replace(sibling."customerPhone", '\\D', '', 'g') = target.phone
    GROUP BY target."id"
  `,
    storeId,
    ...orderIds
  );
}

/**
 * The blast radius of a customer-level change.
 *
 * Phone *and* customer, because the two do not always agree: the per-phone
 * counts are matched on the digits-only string, so "+8801712345678" and
 * "01712345678" are different keys, while `flagStatus` hangs off the shared
 * customer row. Re-scoring only one of the two would leave the other stale.
 */
export async function getOrderIdsForCustomer(
  storeId: string,
  input: { customerId: string | null; phone: string }
) {
  await ensureFakeOrderRiskSchema();

  const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
    `
    SELECT "id"
    FROM ${orderTable()}
    WHERE "storeId" = $1
      AND (
        regexp_replace("customerPhone", '\\D', '', 'g') = $2
        OR ($3::text IS NOT NULL AND "customerId" = $3)
      )
  `,
    storeId,
    input.phone,
    input.customerId
  );

  return rows.map((row) => row.id);
}

export async function getUnassessedOrderIds(storeId: string, limit: number) {
  await ensureFakeOrderRiskSchema();

  const orders = await prisma.order.findMany({
    where: {
      riskAssessedAt: null,
      storeId
    },
    select: {
      id: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });

  return orders.map((order) => order.id);
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                     */
/* -------------------------------------------------------------------------- */

export type RiskAssessmentWrite = {
  factors: RiskFactor[];
  level: RiskLevel;
  orderId: string;
  score: number;
  /** Omitted when a seller decision already owns the status. */
  verificationStatus?: VerificationStatus;
};

export async function saveRiskAssessments(storeId: string, writes: RiskAssessmentWrite[]) {
  if (writes.length === 0) {
    return;
  }

  await ensureFakeOrderRiskSchema();

  const assessedAt = new Date();

  await prisma.$transaction(
    writes.map((write) =>
      prisma.order.updateMany({
        where: {
          id: write.orderId,
          storeId
        },
        data: {
          riskAssessedAt: assessedAt,
          riskFactors: write.factors,
          riskLevel: write.level,
          riskScore: write.score,
          ...(write.verificationStatus ? { verificationStatus: write.verificationStatus } : {})
        }
      })
    )
  );
}

export async function updateOrderVerificationStatus(
  storeId: string,
  orderId: string,
  status: VerificationStatus
) {
  await ensureFakeOrderRiskSchema();

  const decidedAt = new Date();

  return prisma.order.updateMany({
    where: {
      id: orderId,
      storeId
    },
    data: {
      markedFakeAt: status === "FAKE" || status === "BLOCKED" ? decidedAt : null,
      verificationDecidedAt: decidedAt,
      verificationStatus: status,
      verifiedAt: status === "VERIFIED" ? decidedAt : null
    }
  });
}

export async function updateCustomerFlagStatus(storeId: string, customerId: string, status: CustomerFlagStatus) {
  return prisma.customer.updateMany({
    where: {
      id: customerId,
      storeId
    },
    data: {
      flagStatus: status
    }
  });
}

function orderTable() {
  return `"${getDatabaseSchemaName()}"."Order"`;
}
