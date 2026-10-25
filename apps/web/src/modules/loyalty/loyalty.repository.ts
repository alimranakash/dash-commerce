import { prisma } from "@dash/db";
import type { Prisma, PrismaClient } from "@dash/db";
import { loyaltyPhoneSearchDigits } from "./loyalty.rules";

/**
 * Every loyalty read and settings write. Each statement is scoped by
 * `storeId`, including the ones that also name a unique id, so an id from
 * another store finds nothing rather than finding somebody else's member.
 *
 * Ledger writes are not here: they belong to `loyalty.ledger.ts`, which runs
 * on the transaction it is handed.
 */

export type LoyaltyReadClient =
  | Pick<PrismaClient, "loyaltyMember" | "loyaltyTransaction">
  | Prisma.TransactionClient;

export type LoyaltySettingRecord = Prisma.StoreLoyaltySettingGetPayload<Record<string, never>>;

const memberSelect = {
  customerId: true,
  enrolledAt: true,
  id: true,
  phoneKey: true,
  pointsBalance: true,
  suspendedAt: true
} satisfies Prisma.LoyaltyMemberSelect;

export type LoyaltyMemberRecord = Prisma.LoyaltyMemberGetPayload<{ select: typeof memberSelect }>;

export function getLoyaltySettingRecord(storeId: string) {
  return prisma.storeLoyaltySetting.findUnique({
    where: {
      storeId
    }
  });
}

export function upsertLoyaltySettingRecord(
  storeId: string,
  data: {
    amountPerPoint: string;
    enabled: boolean;
    maxRedeemPercent: number;
    minRedeemPoints: number;
    pointValue: string;
    programName: string;
    redemptionEnabled: boolean;
  }
) {
  return prisma.storeLoyaltySetting.upsert({
    create: {
      ...data,
      storeId
    },
    update: data,
    where: {
      storeId
    }
  });
}

export function findLoyaltyMemberForCustomer(
  storeId: string,
  customerId: string,
  client: LoyaltyReadClient = prisma
) {
  return client.loyaltyMember.findFirst({
    select: memberSelect,
    where: {
      customerId,
      storeId
    }
  });
}

export function findLoyaltyMemberById(storeId: string, memberId: string) {
  return prisma.loyaltyMember.findFirst({
    select: memberSelect,
    where: {
      id: memberId,
      storeId
    }
  });
}

export function findLoyaltyMemberByPhoneKey(
  storeId: string,
  phoneKey: string,
  client: LoyaltyReadClient = prisma
) {
  return client.loyaltyMember.findFirst({
    select: memberSelect,
    where: {
      phoneKey,
      storeId
    }
  });
}

const memberListSelect = {
  customer: {
    select: {
      email: true,
      name: true,
      phone: true
    }
  },
  enrolledAt: true,
  id: true,
  phoneKey: true,
  pointsBalance: true,
  suspendedAt: true
} satisfies Prisma.LoyaltyMemberSelect;

export type LoyaltyMemberListRecord = Prisma.LoyaltyMemberGetPayload<{
  select: typeof memberListSelect;
}>;

export type LoyaltyMemberPageQuery = {
  /** The id of the last member on the previous page, already checked to be this store's. */
  cursor?: string | undefined;
  search?: string | undefined;
  storeId: string;
  take: number;
};

/**
 * A page of members, newest first, the way `getCustomerPageForStore` walks
 * customers: cursor rather than offset, with `id` in the ordering so members
 * enrolled in the same instant keep a stable place.
 *
 * The search matches the normalised phone key by its digits — so "+8801712"
 * finds `01712…` — and the customer's name, phone as typed and email.
 */
export function listLoyaltyMembersPage(query: LoyaltyMemberPageQuery) {
  return prisma.loyaltyMember.findMany({
    orderBy: [{ enrolledAt: "desc" }, { id: "desc" }],
    select: memberListSelect,
    take: query.take,
    where: {
      storeId: query.storeId,
      ...memberSearchWhere(query.search)
    },
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {})
  });
}

function memberSearchWhere(search: string | undefined): Prisma.LoyaltyMemberWhereInput {
  const query = search?.trim().slice(0, 80);

  if (!query) {
    return {};
  }

  const digits = loyaltyPhoneSearchDigits(query);

  return {
    OR: [
      ...(digits ? [{ phoneKey: { contains: digits } }] : []),
      { customer: { name: { contains: query, mode: "insensitive" } } },
      { customer: { phone: { contains: query } } },
      { customer: { email: { contains: query, mode: "insensitive" } } }
    ]
  };
}

export function findLoyaltyMemberInStore(storeId: string, memberId: string) {
  return prisma.loyaltyMember.findFirst({
    select: {
      id: true,
      suspendedAt: true
    },
    where: {
      id: memberId,
      storeId
    }
  });
}

export async function getLoyaltyMemberTotals(storeId: string) {
  const [all, suspended] = await Promise.all([
    prisma.loyaltyMember.aggregate({
      _count: {
        _all: true
      },
      _sum: {
        pointsBalance: true
      },
      where: {
        storeId
      }
    }),
    prisma.loyaltyMember.count({
      where: {
        storeId,
        suspendedAt: {
          not: null
        }
      }
    })
  ]);

  return {
    members: all._count._all,
    pointsHeld: all._sum.pointsBalance ?? 0,
    suspended
  };
}

export function findLoyaltyMemberDetail(storeId: string, memberId: string) {
  return prisma.loyaltyMember.findFirst({
    select: {
      customer: {
        select: {
          createdAt: true,
          email: true,
          id: true,
          name: true,
          phone: true
        }
      },
      enrolledAt: true,
      id: true,
      ledgerSequence: true,
      phoneKey: true,
      pointsBalance: true,
      suspendedAt: true
    },
    where: {
      id: memberId,
      storeId
    }
  });
}

/**
 * One page of a member's history, newest first, by `sequence` — the order the
 * rows actually committed in. `before` is the lowest sequence on the page the
 * reader has already seen.
 */
export function listLoyaltyLedgerPage(query: {
  before?: number | undefined;
  memberId: string;
  storeId: string;
  take: number;
}) {
  return prisma.loyaltyTransaction.findMany({
    orderBy: {
      sequence: "desc"
    },
    select: {
      actorUserId: true,
      amountPerPoint: true,
      balanceAfter: true,
      createdAt: true,
      id: true,
      note: true,
      points: true,
      sequence: true,
      sourceId: true,
      sourceType: true,
      type: true
    },
    take: query.take,
    where: {
      memberId: query.memberId,
      storeId: query.storeId,
      ...(query.before ? { sequence: { lt: query.before } } : {})
    }
  });
}

/** The opt-in recorded for one offline sale, naming the customer who gave it. */
export function findSaleLoyaltyOptIn(storeId: string, saleId: string) {
  return prisma.saleLoyaltyOptIn.findFirst({
    select: {
      customerId: true
    },
    where: {
      saleId,
      storeId
    }
  });
}

/** One order's own ledger rows, in commit order, for the order page. */
export function listOrderLoyaltyRows(storeId: string, orderId: string) {
  return prisma.loyaltyTransaction.findMany({
    orderBy: {
      sequence: "asc"
    },
    select: {
      points: true,
      type: true
    },
    where: {
      sourceId: orderId,
      sourceType: "ORDER",
      storeId
    }
  });
}

/**
 * Display names for the people who made a page of manual entries. The ids
 * come only from this store's own ledger rows, so nothing here can name
 * somebody who never acted on this store.
 */
export function findLedgerActors(userIds: string[]) {
  return userIds.length
    ? prisma.user.findMany({
        select: {
          email: true,
          id: true,
          name: true
        },
        where: {
          id: {
            in: userIds
          }
        }
      })
    : Promise.resolve([]);
}

/**
 * Suspends or resumes, and only from the opposite state: the condition is in
 * the `where`, so a repeated or racing request changes nothing the second
 * time. Neither the balance nor a single ledger row is touched.
 */
export function setLoyaltyMemberSuspended(
  storeId: string,
  memberId: string,
  suspended: boolean,
  userId: string
) {
  return prisma.loyaltyMember.updateMany({
    data: suspended
      ? { suspendedAt: new Date(), suspendedByUserId: userId }
      : { suspendedAt: null, suspendedByUserId: null },
    where: {
      id: memberId,
      storeId,
      suspendedAt: suspended ? null : { not: null }
    }
  });
}

/** Files the conflict, or reopens it — another opt-in means another order went unrewarded. */
export function upsertLoyaltyConflict(input: {
  customerId: string;
  memberId: string;
  orderId: string;
  storeId: string;
}) {
  return prisma.loyaltyEnrollmentConflict.upsert({
    create: input,
    update: {
      occurrences: {
        increment: 1
      },
      orderId: input.orderId,
      resolvedAt: null,
      resolvedByUserId: null
    },
    where: {
      storeId_customerId_memberId: {
        customerId: input.customerId,
        memberId: input.memberId,
        storeId: input.storeId
      }
    }
  });
}

export function listUnresolvedLoyaltyConflicts(storeId: string, take: number) {
  return prisma.loyaltyEnrollmentConflict.findMany({
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    select: {
      createdAt: true,
      customer: {
        select: {
          name: true,
          phone: true
        }
      },
      id: true,
      member: {
        select: {
          customer: {
            select: {
              name: true,
              phone: true
            }
          },
          id: true
        }
      },
      occurrences: true,
      orderId: true,
      updatedAt: true
    },
    take,
    where: {
      resolvedAt: null,
      storeId
    }
  });
}

export function countUnresolvedLoyaltyConflicts(storeId: string) {
  return prisma.loyaltyEnrollmentConflict.count({
    where: {
      resolvedAt: null,
      storeId
    }
  });
}

export function findLoyaltyConflictInStore(storeId: string, conflictId: string) {
  return prisma.loyaltyEnrollmentConflict.findFirst({
    select: {
      id: true,
      resolvedAt: true
    },
    where: {
      id: conflictId,
      storeId
    }
  });
}

/** Marks a conflict dealt with, once: an already-resolved row is left as it is. */
export function resolveLoyaltyConflictRecord(storeId: string, conflictId: string, userId: string) {
  return prisma.loyaltyEnrollmentConflict.updateMany({
    data: {
      resolvedAt: new Date(),
      resolvedByUserId: userId
    },
    where: {
      id: conflictId,
      resolvedAt: null,
      storeId
    }
  });
}
