import { readClientIp } from "../../lib/request-ip";
import { safeEquals } from "../../lib/secret-box";
import { createSystemLog } from "../../lib/system-log";
import { hashAiApiKey, isAiApiKeyFormat, readBearerToken } from "./ai-key-token";
import { findApiKeyByTokenHash, touchApiKeyLastUsed } from "./ai-key.repository";
import { parseStoredScopes, type AiScope } from "./ai.schema";

/**
 * The one place the AI API decides who is calling and which store they are.
 *
 * Written as a pure function of a `Request` — no `NextResponse`, no redirects —
 * so it is the machine-to-machine twin of `requireStore()` rather than a copy of
 * it: routes get a decision, `ai-route.ts` turns that decision into HTTP, and
 * the verification script can drive it without standing up Next. Nothing else in
 * the codebase should re-derive a tenant from a bearer token.
 *
 * ## Tenant identity
 *
 * `storeId` comes from the authenticated key row and from nowhere else. This
 * file never reads a query parameter, a body field, or an `X-Store-Id` header,
 * and adding a code path that did would defeat the whole design — the key *is*
 * the tenant. A caller may send whatever they like alongside their credentials;
 * it is ignored.
 *
 * ## Failing closed
 *
 * Every path that is not a positive match returns a failure. Missing header,
 * wrong scheme, wrong format, no matching row, revoked, expired, store not
 * servable, scope not granted — all refusals. There is no fallback to a session
 * cookie and no development-mode bypass, because either would be a way in that
 * nobody tests.
 */

export type AiAuthFailureReason =
  | "expired_key"
  | "insufficient_scope"
  | "malformed_credentials"
  | "missing_credentials"
  | "revoked_key"
  | "store_unavailable"
  | "unknown_key";

export type AiApiIdentity = {
  /** Last four characters of the key, for display and for logs. */
  keyHint: string;
  keyId: string;
  keyName: string;
  scopes: AiScope[];
  /** The tenant. Derived from the credential, never from the request. */
  storeId: string;
};

export type AiAuthResult =
  | {
      identity: AiApiIdentity;
      ok: true;
    }
  | {
      /** Already safe to hand to the caller — see `clientMessageFor`. */
      message: string;
      ok: false;
      reason: AiAuthFailureReason;
    };

export type ResolveApiKeyStoreOptions = {
  /** The scope this endpoint needs. Omit only for an endpoint that needs none. */
  requiredScope?: AiScope | undefined;
};

/**
 * A store still being set up may call the API; a suspended or archived one may
 * not. Suspension is a platform decision and has to bind every door, this one
 * included.
 */
const SERVABLE_STORE_STATUSES = new Set(["ACTIVE", "DRAFT"]);

/**
 * How stale `lastUsedAt` is allowed to get.
 *
 * Without this, an agent polling once a second would mean a database write per
 * request for a field nothing reads to make a decision. A minute's resolution is
 * far more than "is this key still in use" needs.
 */
const LAST_USED_RESOLUTION_MS = 60_000;

/**
 * How often one (key, outcome) pair may reach `SystemLog`.
 *
 * Every attempt is logged to the process log. The *durable* record is coalesced,
 * because SystemLog is the admin-facing system journal rather than an access
 * log: a row per successful request would bury every other event in it, and the
 * holder of one revoked key could otherwise grow the table at will. See
 * docs/ai-api.md.
 */
const AUDIT_COALESCE_MS = 15 * 60 * 1000;

const lastAuditAt = new Map<string, number>();

export async function resolveApiKeyStore(
  request: Request,
  options: ResolveApiKeyStoreOptions = {}
): Promise<AiAuthResult> {
  const clientIp = readClientIp(request.headers);
  const header = request.headers.get("authorization");

  // "No credentials" and "credentials I cannot read" are kept apart because the
  // audit trail records the reason: the first is usually a client that was never
  // configured, the second is one configured wrongly, and telling an integrator
  // which of the two they have is most of the debugging. Both refuse.
  if (!header?.trim()) {
    return refuse("missing_credentials", clientIp);
  }

  const presented = readBearerToken(header);

  // A shape check before a query: garbage, a truncated paste, the wrong auth
  // scheme, or somebody sending a session cookie should cost a regex rather than
  // a round trip.
  if (!presented || !isAiApiKeyFormat(presented)) {
    return refuse("malformed_credentials", clientIp);
  }

  const tokenHash = hashAiApiKey(presented);
  const record = await findApiKeyByTokenHash(tokenHash);

  if (!record) {
    return refuse("unknown_key", clientIp);
  }

  // Belt and braces. The lookup above already matched on a unique column, and
  // the values compared here are SHA-256 digests rather than the secret itself,
  // so a timing signal cannot be walked back through the hash. It is here so
  // this file never contains a bare equality between a stored and a presented
  // credential for someone to copy somewhere it would matter.
  if (!safeEquals(record.tokenHash, tokenHash)) {
    return refuse("unknown_key", clientIp);
  }

  if (record.revokedAt) {
    return refuse("revoked_key", clientIp, record);
  }

  if (record.expiresAt && record.expiresAt.getTime() <= Date.now()) {
    return refuse("expired_key", clientIp, record);
  }

  if (!record.store || !SERVABLE_STORE_STATUSES.has(record.store.status)) {
    return refuse("store_unavailable", clientIp, record);
  }

  const scopes = parseStoredScopes(record.scopes);

  if (options.requiredScope && !scopes.includes(options.requiredScope)) {
    return refuse("insufficient_scope", clientIp, record, options.requiredScope);
  }

  await touchLastUsed(record.id, record.lastUsedAt);
  await audit({
    clientIp,
    keyHint: record.hint,
    keyId: record.id,
    level: "INFO",
    message: `AI API key "${record.name}" authenticated.`,
    outcome: "success",
    storeId: record.storeId
  });

  return {
    identity: {
      keyHint: record.hint,
      keyId: record.id,
      keyName: record.name,
      scopes,
      // The tenant, taken from the credential. Note that nothing above ever
      // looked at the request for it.
      storeId: record.storeId
    },
    ok: true
  };
}

/**
 * Scope check for an already-authenticated identity, for a route that needs a
 * second one. Endpoints with a single requirement pass `requiredScope` instead.
 */
export function hasAiScope(identity: AiApiIdentity, scope: AiScope) {
  return identity.scopes.includes(scope);
}

type KeyRecord = NonNullable<Awaited<ReturnType<typeof findApiKeyByTokenHash>>>;

async function refuse(
  reason: AiAuthFailureReason,
  clientIp: string | null,
  record?: KeyRecord,
  requiredScope?: AiScope
): Promise<AiAuthResult> {
  if (record) {
    // Attributable to a real key, so the seller who owns it can see it happened.
    await audit({
      clientIp,
      keyHint: record.hint,
      keyId: record.id,
      level: "WARNING",
      message: `AI API request refused (${reason}) for key "${record.name}"${
        requiredScope ? ` — missing scope ${requiredScope}` : ""
      }.`,
      outcome: reason,
      storeId: record.storeId
    });
  } else {
    // Not attributable to any store, so it goes to the process log only: an
    // unauthenticated caller must never be able to write rows into the database.
    console.warn(`[ai-api] refused: ${reason}${clientIp ? ` from ${clientIp}` : ""}`);
  }

  return {
    message: clientMessageFor(reason, requiredScope),
    ok: false,
    reason
  };
}

function clientMessageFor(reason: AiAuthFailureReason, requiredScope?: AiScope) {
  switch (reason) {
    case "expired_key":
      return "This API key has expired.";
    case "insufficient_scope":
      return requiredScope
        ? `This API key does not have the ${requiredScope} scope.`
        : "This API key does not have the required scope.";
    case "revoked_key":
      return "This API key has been revoked.";
    case "store_unavailable":
      return "This store is not available.";
    default:
      // Missing, malformed and unknown share one answer on purpose: the three
      // are indistinguishable to anyone who does not already hold a real key,
      // and keeping them so means a guess reveals nothing about how close it was.
      return "Invalid API credentials.";
  }
}

async function touchLastUsed(apiKeyId: string, lastUsedAt: Date | null) {
  const now = Date.now();

  if (lastUsedAt && now - lastUsedAt.getTime() < LAST_USED_RESOLUTION_MS) {
    return;
  }

  try {
    await touchApiKeyLastUsed(apiKeyId, new Date(now));
  } catch (error) {
    // A bookkeeping write must never turn an authorised request into a failure.
    console.warn(
      `[ai-api] could not record last-used for key ${apiKeyId}: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

type AuditInput = {
  clientIp: string | null;
  keyHint: string;
  keyId: string;
  level: "INFO" | "WARNING";
  message: string;
  outcome: string;
  storeId: string;
};

/**
 * The audit trail.
 *
 * Note what is passed in, and what is therefore impossible to log by accident:
 * the raw key never reaches this function, neither does the `Authorization`
 * header, and neither does `tokenHash`. Only the key's id and its last four
 * characters — which is what a seller already reads in settings — plus the
 * outcome and the address it came from.
 */
async function audit(input: AuditInput) {
  const line = `[ai-api] ${input.outcome} key=${input.keyId} hint=${input.keyHint} store=${input.storeId}${
    input.clientIp ? ` ip=${input.clientIp}` : ""
  }`;

  if (input.level === "WARNING") {
    console.warn(line);
  } else {
    console.info(line);
  }

  if (!shouldWriteAuditRow(`${input.keyId}:${input.outcome}`)) {
    return;
  }

  try {
    await createSystemLog({
      level: input.level,
      message: input.message,
      metadata: {
        keyHint: input.keyHint,
        keyId: input.keyId,
        outcome: input.outcome,
        ...(input.clientIp ? { clientIp: input.clientIp } : {})
      },
      source: "API",
      storeId: input.storeId
    });
  } catch (error) {
    console.warn(
      `[ai-api] could not write audit log: ${
        error instanceof Error ? error.message : "unknown error"
      }`
    );
  }
}

function shouldWriteAuditRow(key: string) {
  const now = Date.now();
  const previous = lastAuditAt.get(key);

  if (previous !== undefined && now - previous < AUDIT_COALESCE_MS) {
    return false;
  }

  lastAuditAt.set(key, now);

  return true;
}

/** Exposed for the verification script, so one check cannot mask the next. */
export function resetAiAuditCoalescing() {
  lastAuditAt.clear();
}
