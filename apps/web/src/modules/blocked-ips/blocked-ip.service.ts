import {
  deleteBlockedIp,
  getIpOrderStats,
  getOrderIpAddress,
  listBlockedIpsForStore,
  listRepeatOffenderIps,
  upsertBlockedIp,
  type IpOrderStats
} from "./blocked-ip.repository";
import {
  createBlockedIpSchema,
  expiresAtFromDuration,
  normaliseIpAddress,
  type BlockedIpFormInput
} from "./blocked-ip.schema";

export type { IpOrderStats };

export class BlockedIpError extends Error {
  /** Field the message belongs against, so the form can highlight it. */
  readonly field: string;

  constructor(message: string, field = "form") {
    super(message);
    this.name = "BlockedIpError";
    this.field = field;
  }
}

/**
 * Distinct phone numbers from one address, above which the seller gets a warning.
 *
 * Not a rule and not enforced — a threshold for a sentence, so the number that
 * decides whether a block is safe is the one the seller actually looks at.
 * Carrier-grade NAT puts thousands of unrelated shoppers behind a single mobile
 * address, and the difference between that and one abuser cycling fake numbers
 * is a judgement only the seller can make.
 */
export const SHARED_ADDRESS_PHONE_COUNT = 5;

/** Whether a row is still refusing checkouts, or is only a record of one that did. */
export type BlockedIpState = "ACTIVE" | "EXPIRED";

/** The shape the list view reads — never the Prisma row directly. */
export type BlockedIpView = {
  createdAt: Date;
  expiresAt: Date | null;
  fakeOrderCount: number;
  id: string;
  ipAddress: string;
  lastOrderAt: Date | null;
  orderCount: number;
  phoneCount: number;
  reason: string | null;
  state: BlockedIpState;
};

export type BlockedIpDashboard = {
  blocked: BlockedIpView[];
  /**
   * Addresses the store has marked orders fake from and has not blocked yet.
   * Filtered here rather than in SQL so the two lists cannot disagree about
   * what "already blocked" means.
   */
  suggestions: IpOrderStats[];
};

export async function getBlockedIpDashboard(storeId: string): Promise<BlockedIpDashboard> {
  const [blocked, suggestions] = await Promise.all([
    listBlockedIpsForStore(storeId),
    listRepeatOffenderIps(storeId)
  ]);
  const statsByIp = new Map(
    (await getIpOrderStats(storeId, blocked.map((row) => row.ipAddress))).map((stats) => [
      stats.ipAddress,
      stats
    ])
  );
  const blockedAddresses = new Set(blocked.map((row) => row.ipAddress));
  const now = Date.now();

  return {
    blocked: blocked.map((row) => {
      const stats = statsByIp.get(row.ipAddress);

      return {
        createdAt: row.createdAt,
        expiresAt: row.expiresAt,
        fakeOrderCount: stats?.fakeOrderCount ?? 0,
        id: row.id,
        ipAddress: row.ipAddress,
        lastOrderAt: stats?.lastOrderAt ?? null,
        orderCount: stats?.orderCount ?? 0,
        phoneCount: stats?.phoneCount ?? 0,
        reason: row.reason,
        state: row.expiresAt && row.expiresAt.getTime() <= now ? "EXPIRED" : "ACTIVE"
      };
    }),
    suggestions: suggestions.filter((stats) => !blockedAddresses.has(stats.ipAddress))
  };
}

export async function blockIp(storeId: string, input: BlockedIpFormInput) {
  const data = createBlockedIpSchema.parse(input);

  return upsertBlockedIp(storeId, {
    expiresAt: expiresAtFromDuration(data.duration),
    ipAddress: data.ipAddress,
    reason: data.reason
  });
}

/**
 * Blocks whatever address an order arrived from.
 *
 * Orders the seller typed in by hand have no address, and neither does anything
 * placed before the column existed — so this reports rather than silently doing
 * nothing, which from the review page would look like a broken button.
 */
export async function blockIpFromOrder(
  storeId: string,
  orderId: string,
  input: Omit<BlockedIpFormInput, "ipAddress">
) {
  const ipAddress = await getOrderIpAddress(storeId, orderId);

  if (!ipAddress) {
    throw new BlockedIpError("This order has no recorded IP address to block.");
  }

  // Stored addresses were normalised on the way in, but an order written before
  // this feature shipped was not, so it is re-checked rather than trusted.
  if (!normaliseIpAddress(ipAddress)) {
    throw new BlockedIpError("This order's recorded IP address could not be read.");
  }

  return blockIp(storeId, { ...input, ipAddress });
}

export async function unblockIp(storeId: string, blockedIpId: string) {
  const result = await deleteBlockedIp(storeId, blockedIpId);

  return result.count > 0;
}
