import { findActiveBlockedIp } from "./blocked-ip.repository";
import { normaliseIpAddress } from "./blocked-ip.schema";

/**
 * What a blocked shopper is told.
 *
 * Deliberately says nothing about IP addresses. Naming the mechanism hands an
 * abuser the one fact they need in order to work around it, and tells the far
 * more common case — a real customer who shares a carrier NAT with one — something
 * they can neither understand nor act on. A route to a human is the only part of
 * this that is any use to the person reading it.
 */
export const BLOCKED_IP_MESSAGE =
  "We could not accept this order. Please contact the store to complete your purchase.";

export class BlockedIpError extends Error {
  constructor(message = BLOCKED_IP_MESSAGE) {
    super(message);
    this.name = "BlockedIpError";
  }
}

/**
 * Refuses a checkout from a blocked address.
 *
 * An absent or unparseable address is *not* treated as a block. `X-Forwarded-For`
 * is client-controllable, so a missing header proves nothing about who is asking,
 * and failing closed on it would turn any proxy misconfiguration into a store
 * that cannot sell. The blocklist raises the cost of abuse; it is not, and cannot
 * be, an authentication boundary.
 */
export async function assertIpNotBlocked(storeId: string, ipAddress: string | null) {
  if (!(await isIpBlocked(storeId, ipAddress))) {
    return;
  }

  throw new BlockedIpError();
}

export async function isIpBlocked(storeId: string, ipAddress: string | null) {
  const normalised = ipAddress ? normaliseIpAddress(ipAddress) : null;

  if (!normalised) {
    return false;
  }

  return (await findActiveBlockedIp(storeId, normalised)) !== null;
}
