import { createHash, randomBytes } from "node:crypto";

/**
 * Minting and recognising AI API keys.
 *
 * Deliberately the same shape as `modules/staff/staff-token.ts`, which already
 * solved this problem for invite links: random bytes in, SHA-256 to the
 * database, raw value handed back exactly once. The differences are the prefix
 * — so a leaked string is recognisable as a credential in a log or a paste —
 * and the hint, which is what settings shows instead of the key.
 */

/**
 * Prefixed rather than bare so the value is self-describing: secret scanners key
 * on prefixes, and a seller who finds one in a config file can tell what it
 * opens. `live` leaves room for a `sk_test_` band later without changing the
 * parser.
 */
export const AI_API_KEY_PREFIX = "sk_live_";

/** 256 bits, so the hash column cannot be brute-forced. */
const KEY_BYTES = 32;

/** 32 bytes of base64url is always 43 characters, with no padding. */
const SECRET_LENGTH = 43;

const KEY_PATTERN = new RegExp(`^${AI_API_KEY_PREFIX}[A-Za-z0-9_-]{${SECRET_LENGTH}}$`);

export type GeneratedAiApiKey = {
  /** The hint stored alongside the hash. */
  hint: string;
  /** The raw key. Returned once, never stored, never logged. */
  key: string;
  /** The only part of the key that reaches the database. */
  tokenHash: string;
};

export function createAiApiKey(): GeneratedAiApiKey {
  const key = `${AI_API_KEY_PREFIX}${randomBytes(KEY_BYTES).toString("base64url")}`;

  return {
    hint: aiApiKeyHint(key),
    key,
    tokenHash: hashAiApiKey(key)
  };
}

/**
 * The stored form of a key. Plain SHA-256 rather than bcrypt for the same reason
 * `hashStaffInviteToken` gives: the input is 256 random bits, so there is no
 * dictionary to slow down, and authentication has to be one indexed equality
 * query rather than a scan-and-compare over every key in the table.
 */
export function hashAiApiKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

/** Last four characters — enough to identify a key, useless to replay one. */
export function aiApiKeyHint(key: string) {
  return key.slice(-4);
}

/**
 * A cheap shape check before anything touches the database.
 *
 * Not a security control — it rejects nothing an attacker could not simply
 * format correctly. It is here so that garbage, a truncated paste, or somebody
 * sending a session cookie costs one regex instead of a query.
 */
export function isAiApiKeyFormat(value: string) {
  return KEY_PATTERN.test(value);
}

/**
 * Pulls the key out of an `Authorization` header.
 *
 * Bearer only, and only ever from this header: a key in a query string ends up
 * in access logs, in `Referer`, and in browser history, so the parser simply has
 * nowhere else to look.
 */
export function readBearerToken(header: string | null) {
  if (!header) {
    return null;
  }

  const [scheme, ...rest] = header.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || rest.length !== 1) {
    return null;
  }

  return rest[0] ?? null;
}
