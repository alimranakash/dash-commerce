import { createHash, randomBytes } from "node:crypto";

/**
 * How long an invite link stays usable. Short enough that a link forwarded into
 * a group chat months ago is dead, long enough that a seller can send it on a
 * Friday and have it work on Monday.
 */
export const STAFF_INVITE_TTL_DAYS = 7;

/** 256 bits of entropy, so the hash lookup cannot be brute-forced. */
const TOKEN_BYTES = 32;

/**
 * Mints an invite token and the value that is actually stored.
 *
 * The raw token is returned to the caller exactly once — it goes into the link
 * the seller copies and is never written anywhere. Only `tokenHash` reaches the
 * database, so reading the table (a dump, a backup, the admin panel) yields
 * nothing that can be redeemed.
 */
export function createStaffInviteToken() {
  const token = randomBytes(TOKEN_BYTES).toString("base64url");

  return {
    token,
    tokenHash: hashStaffInviteToken(token)
  };
}

/**
 * The stored form of a token. Plain SHA-256 rather than a password hash on
 * purpose: the input is 256 random bits, so there is no dictionary to slow down,
 * and lookup has to be a single indexed equality query.
 */
export function hashStaffInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function getStaffInviteExpiry(now = new Date()) {
  return new Date(now.getTime() + STAFF_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
}
