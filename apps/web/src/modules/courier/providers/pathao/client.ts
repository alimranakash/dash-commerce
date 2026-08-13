import { CourierError } from "../../courier-errors";
import { courierRequest, extractFieldErrors } from "../../courier-http";
import type { CourierContext } from "../provider.types";

/**
 * Pathao HTTP + OAuth2.
 *
 * All of the token lifecycle lives here: the provider contract knows nothing
 * about tokens, and Steadfast's static-header auth is untouched. Tokens are
 * kept in the context's encrypted secret store, so they survive across requests
 * without ever being written in plaintext.
 *
 * Refresh happens in two places, deliberately: proactively when the stored
 * expiry is near, and reactively exactly once on a 401 — because a token can be
 * revoked server-side long before it expires.
 */

export const pathaoSandboxBaseUrl = "https://courier-api-sandbox.pathao.com";
export const pathaoProductionBaseUrl = "https://api-hermes.pathao.com";

/** Refresh this long before the stated expiry rather than racing it. */
const refreshSkewMs = 6 * 60 * 60 * 1000;

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
};

type PathaoEnvelope = {
  code?: number;
  errors?: unknown;
  message?: string;
  type?: string;
};

type PathaoRequest = {
  body?: unknown;
  method: "GET" | "POST";
  path: string;
  retry?: boolean;
};

export function pathaoBaseUrl(context: CourierContext) {
  return context.credentials.baseUrl?.trim() || pathaoSandboxBaseUrl;
}

export async function pathaoRequest<T extends Record<string, unknown>>(
  context: CourierContext,
  request: PathaoRequest
) {
  const token = await resolveAccessToken(context);

  try {
    return await sendAuthorized<T>(context, request, token);
  } catch (error) {
    // A 401 on a token we believed was valid means it was revoked or rotated.
    // Re-issue once, then give up rather than looping.
    if (error instanceof CourierError && error.kind === "AUTH") {
      const fresh = await issueToken(context);

      return sendAuthorized<T>(context, request, fresh);
    }

    throw error;
  }
}

async function sendAuthorized<T extends Record<string, unknown>>(
  context: CourierContext,
  request: PathaoRequest,
  token: string
) {
  const { data } = await courierRequest<T>({
    baseUrl: pathaoBaseUrl(context),
    headers: {
      Authorization: `Bearer ${token}`
    },
    method: request.method,
    path: request.path,
    timeoutMs: context.timeoutMs,
    ...(request.body !== undefined ? { body: request.body } : {}),
    ...(request.retry !== undefined ? { retry: request.retry } : {})
  });

  assertEnvelopeOk(data);

  return data;
}

/** Cached token if it is still comfortably valid, otherwise a fresh one. */
async function resolveAccessToken(context: CourierContext) {
  const cache = await context.secretStore.read();
  const expiresAt = Number(cache.pathaoTokenExpiresAt ?? 0);

  if (cache.pathaoAccessToken && Number.isFinite(expiresAt) && expiresAt - Date.now() > refreshSkewMs) {
    return cache.pathaoAccessToken;
  }

  if (cache.pathaoRefreshToken) {
    try {
      return await issueToken(context, cache.pathaoRefreshToken);
    } catch {
      // A stale refresh token is not fatal — fall back to a password grant.
    }
  }

  return issueToken(context);
}

/**
 * `grant_type=password` when no refresh token is supplied, otherwise
 * `grant_type=refresh_token`. Both return the same envelope.
 */
async function issueToken(context: CourierContext, refreshToken?: string) {
  const clientId = context.credentials.clientId?.trim();
  const clientSecret = context.credentials.clientSecret?.trim();

  if (!clientId || !clientSecret) {
    throw new CourierError("AUTH", "Pathao client ID and client secret are both required.");
  }

  const body: Record<string, string> = {
    client_id: clientId,
    client_secret: clientSecret
  };

  if (refreshToken) {
    body.grant_type = "refresh_token";
    body.refresh_token = refreshToken;
  } else {
    const username = context.credentials.username?.trim();
    const password = context.credentials.password?.trim();

    if (!username || !password) {
      throw new CourierError("AUTH", "Pathao username and password are both required.");
    }

    body.grant_type = "password";
    body.username = username;
    body.password = password;
  }

  const { data } = await courierRequest<TokenResponse>({
    baseUrl: pathaoBaseUrl(context),
    body,
    method: "POST",
    path: "/aladdin/api/v1/issue-token",
    timeoutMs: context.timeoutMs
  });

  const accessToken = data.access_token?.trim();

  if (!accessToken) {
    throw new CourierError("AUTH", "Pathao did not return an access token.");
  }

  const expiresInSeconds = Number(data.expires_in ?? 0);

  await context.secretStore.write({
    pathaoAccessToken: accessToken,
    pathaoTokenExpiresAt: String(
      Date.now() + (Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds * 1000 : 0)
    ),
    ...(data.refresh_token ? { pathaoRefreshToken: data.refresh_token } : {})
  });

  return accessToken;
}

/** Pathao answers HTTP 200 with its own `code`, so both layers are checked. */
function assertEnvelopeOk(data: unknown) {
  if (!data || typeof data !== "object") {
    throw new CourierError("PROVIDER_DOWN", "Pathao returned an unreadable response.");
  }

  const envelope = data as PathaoEnvelope;
  const code = typeof envelope.code === "number" ? envelope.code : null;

  if (code === null || code < 400) {
    return;
  }

  const message = envelope.message?.trim() || "Pathao rejected the request.";
  // Same extractor the HTTP layer uses, so a field error is surfaced whether
  // Pathao reports the failure as an HTTP status or inside a 200 envelope.
  const details = extractFieldErrors(data);

  if (code === 401 || code === 403) {
    throw new CourierError("AUTH", message, { details, status: code });
  }

  if (code === 404) {
    throw new CourierError("NOT_FOUND", message, { details, status: code });
  }

  if (code === 429) {
    throw new CourierError("RATE_LIMIT", message, { details, status: code });
  }

  if (code >= 500) {
    throw new CourierError("PROVIDER_DOWN", message, { details, status: code });
  }

  throw new CourierError("VALIDATION", message, { details, status: code });
}
