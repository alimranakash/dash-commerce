import { prisma } from "@dash/db";
import { ensureBlockedIpSchema, getDatabaseSchemaName } from "./blocked-ip-schema";

/**
 * Every query in this file starts from `storeId`. A blocklist is one shop's
 * decision about one shop's checkout, so a lookup that could ever match another
 * store's row is a bug regardless of what the caller does with the result.
 */

export type BlockedIpRecord = {
  createdAt: Date;
  expiresAt: Date | null;
  id: string;
  ipAddress: string;
  reason: string | null;
};

/**
 * What the store's own orders say about an address.
 *
 * `phoneCount` is the number that decides whether blocking is safe: Bangladeshi
 * carriers run CGNAT, so one address can be thousands of unrelated shoppers.
 * Forty orders from thirty-eight phone numbers is a mobile network, and blocking
 * it takes real customers with it; twelve orders from one number is a person.
 */
export type IpOrderStats = {
  fakeOrderCount: number;
  ipAddress: string;
  lastOrderAt: Date | null;
  orderCount: number;
  phoneCount: number;
};

export async function listBlockedIpsForStore(storeId: string): Promise<BlockedIpRecord[]> {
  await ensureBlockedIpSchema();

  return prisma.blockedIp.findMany({
    where: {
      storeId
    },
    select: {
      createdAt: true,
      expiresAt: true,
      id: true,
      ipAddress: true,
      reason: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

/**
 * The enforcement lookup. An expired row is not a block: it stays in the table
 * so the seller can see what they did, but it stops refusing checkouts the
 * moment it lapses.
 *
 * `ipAddress` is expected pre-normalised by `normaliseIpAddress`.
 */
export async function findActiveBlockedIp(storeId: string, ipAddress: string) {
  await ensureBlockedIpSchema();

  return prisma.blockedIp.findFirst({
    where: {
      ipAddress,
      storeId,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
    },
    select: {
      expiresAt: true,
      id: true,
      ipAddress: true
    }
  });
}

/**
 * Blocking an address that is already blocked re-arms it rather than failing:
 * the seller's intent is the same either way, and a duplicate-key error here
 * would be a worse answer than simply extending the block they just asked for.
 */
export async function upsertBlockedIp(
  storeId: string,
  data: { expiresAt: Date | null; ipAddress: string; reason: string | undefined }
) {
  await ensureBlockedIpSchema();

  return prisma.blockedIp.upsert({
    where: {
      storeId_ipAddress: {
        ipAddress: data.ipAddress,
        storeId
      }
    },
    update: {
      expiresAt: data.expiresAt,
      reason: data.reason ?? null
    },
    create: {
      expiresAt: data.expiresAt,
      ipAddress: data.ipAddress,
      reason: data.reason ?? null,
      storeId
    }
  });
}

export async function deleteBlockedIp(storeId: string, blockedIpId: string) {
  await ensureBlockedIpSchema();

  // `deleteMany` rather than `delete`: the store scope lives in the same
  // where-clause, so there is no window between checking ownership and writing.
  return prisma.blockedIp.deleteMany({
    where: {
      id: blockedIpId,
      storeId
    }
  });
}

/**
 * Order aggregates for a known set of addresses, for the blocklist table.
 *
 * Raw SQL because `COUNT(DISTINCT …)` and a FILTER clause are not expressible
 * through `groupBy`, and the whole point of the row is the distinct-phone count.
 * Both counters are cast to `int` so the driver hands back numbers rather than
 * bigint strings.
 */
export async function getIpOrderStats(
  storeId: string,
  ipAddresses: readonly string[]
): Promise<IpOrderStats[]> {
  if (ipAddresses.length === 0) {
    return [];
  }

  await ensureBlockedIpSchema();

  return prisma.$queryRawUnsafe<IpOrderStats[]>(
    `${ipStatsSelect()}
      WHERE "storeId" = $1
        AND "ipAddress" IS NOT NULL
        AND "ipAddress" = ANY($2::text[])
      GROUP BY "ipAddress"`,
    storeId,
    [...ipAddresses]
  );
}

/**
 * Addresses worth suggesting: ones this store has already marked orders fake
 * from. Ranked by how much trouble they have caused, not how recently.
 *
 * Deliberately not automatic. The engine can spot a repeat offender, but only
 * the seller knows whether the twelve orders came from one abuser or from a
 * shared office connection, and the stats travel with the suggestion so that
 * judgement can actually be made.
 */
export async function listRepeatOffenderIps(storeId: string, limit = 10): Promise<IpOrderStats[]> {
  await ensureBlockedIpSchema();

  return prisma.$queryRawUnsafe<IpOrderStats[]>(
    `${ipStatsSelect()}
      WHERE "storeId" = $1
        AND "ipAddress" IS NOT NULL
      GROUP BY "ipAddress"
     HAVING COUNT(*) FILTER (WHERE "markedFakeAt" IS NOT NULL) > 0
      ORDER BY COUNT(*) FILTER (WHERE "markedFakeAt" IS NOT NULL) DESC, COUNT(*) DESC
      LIMIT $2`,
    storeId,
    limit
  );
}

function ipStatsSelect() {
  return `SELECT "ipAddress",
                 COUNT(*)::int AS "orderCount",
                 COUNT(DISTINCT "customerPhone")::int AS "phoneCount",
                 COUNT(*) FILTER (WHERE "markedFakeAt" IS NOT NULL)::int AS "fakeOrderCount",
                 MAX("createdAt") AS "lastOrderAt"
            FROM "${getDatabaseSchemaName()}"."Order"`;
}

/**
 * The address one order was placed from, for the "block this IP" button on the
 * review pages. Store-scoped so an order id guessed from another tenant reads
 * as simply not found.
 */
export async function getOrderIpAddress(storeId: string, orderId: string) {
  await ensureBlockedIpSchema();

  const order = await prisma.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    select: {
      ipAddress: true
    }
  });

  return order?.ipAddress ?? null;
}
