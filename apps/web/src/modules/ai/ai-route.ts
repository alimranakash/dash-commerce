import { NextResponse } from "next/server";
import type { ZodType } from "zod";
import { readClientIp } from "../../lib/request-ip";
import { resolveApiKeyStore, type AiApiIdentity, type AiAuthFailureReason } from "./ai-auth";
import {
  aiAnonymousBucket,
  aiApiKeyBucket,
  consumeAiApiToken,
  type AiRateLimitDecision
} from "./ai-rate-limit";
import type { AiScope } from "./ai.schema";

/**
 * The HTTP shell every `/api/ai/v1/**` route wears.
 *
 * Authentication, scope enforcement, throttling, error shaping and the headers
 * that must be on every response live here and only here, so a route handler is
 * the endpoint's actual work and nothing else. The brief was explicit that
 * authentication must not be re-implemented per route; this is what stops it.
 *
 * `ai-auth.ts` decides *who*; this file decides what that means over HTTP. The
 * split keeps the decision testable without Next and keeps status codes out of
 * the module that talks to the database.
 */

/** Raised by a handler that needs a specific non-2xx. */
export class AiApiRouteError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "AiApiRouteError";
    this.status = status;
  }
}

export type AiRouteOptions = {
  /**
   * Tokens this endpoint spends from the key's allowance.
   *
   * A write costs more than a read, on the same bucket rather than a second
   * one: an assistant that has decided to change twenty products should be
   * slowed by the nineteenth, and reads are how it *finds* the twenty, so
   * throttling both equally would make it worse at looking and no safer at
   * acting. Defaults to 1.
   */
  cost?: number | undefined;
  /** The scope this endpoint requires. */
  scope: AiScope;
};

/**
 * The request is handed to the handler alongside the identity so an endpoint
 * can read its own query string. It is *only* ever a source of filters and
 * paging — never of tenancy. `identity.storeId` is the store, and there is no
 * code path on this API by which a request parameter changes it.
 */
export type AiRouteHandler = (
  identity: AiApiIdentity,
  request: Request
) => Promise<unknown> | unknown;

export async function withAiApiRoute(
  request: Request,
  options: AiRouteOptions,
  handler: AiRouteHandler
): Promise<NextResponse> {
  // Throttled by address before anything touches the database, so guessing at
  // keys costs the guesser something even though no guess will ever match.
  const anonymous = consumeAiApiToken(aiAnonymousBucket(readClientIp(request.headers)));

  if (!anonymous.allowed) {
    return rateLimited(anonymous);
  }

  const auth = await resolveApiKeyStore(request, { requiredScope: options.scope });

  if (!auth.ok) {
    return authFailure(auth.reason, auth.message);
  }

  // A second bucket, keyed by the credential rather than the address, so one
  // key cannot spend a whole shared egress IP's budget. The effective ceiling
  // is whichever of the two is tighter.
  const perKey = consumeAiApiToken(aiApiKeyBucket(auth.identity.keyId), options.cost ?? 1);

  if (!perKey.allowed) {
    return rateLimited(perKey);
  }

  try {
    const body = await handler(auth.identity, request);

    return NextResponse.json(body, {
      headers: {
        ...baseHeaders,
        ...rateLimitHeaders(perKey)
      },
      status: 200
    });
  } catch (error) {
    if (error instanceof AiApiRouteError) {
      return errorResponse(error.status, error.code, error.message, rateLimitHeaders(perKey));
    }

    // Nothing about an internal failure reaches the caller: a stack trace or a
    // Prisma message would describe the schema to somebody outside it.
    console.error("[ai-api] unhandled error:", error);

    return errorResponse(
      500,
      "internal_error",
      "The request could not be completed.",
      rateLimitHeaders(perKey)
    );
  }
}

/**
 * Reads and validates an endpoint's query string.
 *
 * A bad `?limit=` is the caller's mistake and answers 400. Note that this is the
 * only place a `ZodError` is turned into a 4xx: a schema failure anywhere else
 * on this API is a *response* that did not match its own contract, which is our
 * bug and stays a 500. Keeping the two apart is why query parsing throws an
 * `AiApiRouteError` here rather than letting a `ZodError` reach the catch below.
 *
 * Unknown parameters are stripped by the schemas rather than rejected, so a
 * `?storeId=` a caller hopes will be honoured is silently ignored — which is
 * exactly what it should be.
 */
export function parseAiQuery<TOutput>(request: Request, schema: ZodType<TOutput>): TOutput {
  const raw: Record<string, string> = {};

  for (const [key, value] of new URL(request.url).searchParams) {
    // An empty value means "not set", not "set to the empty string" — a form or
    // a client library that always appends its parameters should not fail
    // validation for leaving one blank.
    if (value !== "") {
      raw[key] = value;
    }
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    throw new AiApiRouteError(
      400,
      "invalid_query",
      result.error.issues[0]?.message ?? "The query parameters are not valid."
    );
  }

  return result.data;
}

/**
 * Reads and validates a write endpoint's JSON body.
 *
 * The sibling of `parseAiQuery`, and it draws the same line: a malformed body
 * is the caller's mistake and answers 400, while a *response* that fails its own
 * schema stays a 500 because that one is our bug. Both failures are shaped here
 * so no handler has to decide.
 *
 * A body that is not an object at all — an array, a bare string, `null` — is
 * rejected before Zod sees it, so the message names the real problem rather than
 * whichever field happened to be checked first.
 */
export async function parseAiBody<TOutput>(
  request: Request,
  schema: ZodType<TOutput>
): Promise<TOutput> {
  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    throw new AiApiRouteError(400, "invalid_body", "Send a JSON object as the request body.");
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new AiApiRouteError(400, "invalid_body", "Send a JSON object as the request body.");
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".");

    throw new AiApiRouteError(
      400,
      "invalid_body",
      path ? `${path}: ${issue?.message}` : (issue?.message ?? "The request body is not valid.")
    );
  }

  return result.data;
}

const baseHeaders: Record<string, string> = {
  "cache-control": "no-store"
};

function authFailure(reason: AiAuthFailureReason, message: string) {
  if (reason === "insufficient_scope") {
    return errorResponse(403, "insufficient_scope", message);
  }

  if (reason === "store_unavailable") {
    return errorResponse(403, "store_unavailable", message);
  }

  if (reason === "revoked_key" || reason === "expired_key") {
    return errorResponse(401, reason, message, {
      "www-authenticate": `Bearer error="invalid_token"`
    });
  }

  // Missing, malformed and unknown collapse into one code as well as one
  // message: a distinct code would tell a guesser which part they got right.
  return errorResponse(401, "invalid_credentials", message, {
    "www-authenticate": `Bearer error="invalid_token"`
  });
}

function rateLimited(decision: AiRateLimitDecision) {
  return errorResponse(429, "rate_limited", "Too many requests. Slow down and retry.", {
    ...rateLimitHeaders(decision),
    "retry-after": String(decision.retryAfterSeconds)
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  headers: Record<string, string> = {}
) {
  return NextResponse.json(
    { code, message },
    {
      headers: {
        ...baseHeaders,
        ...headers
      },
      status
    }
  );
}

function rateLimitHeaders(decision: AiRateLimitDecision): Record<string, string> {
  return {
    "x-ratelimit-limit": String(decision.limit),
    "x-ratelimit-remaining": String(decision.remaining)
  };
}
