import { CourierError } from "../../courier-errors";
import { courierRequest } from "../../courier-http";
import type { CourierContext } from "../provider.types";

/**
 * Raw HTTP against Steadfast (Packzy). Auth is two static headers plus a JSON
 * content type; nothing else in the codebase knows those header names.
 */

export const steadfastDefaultBaseUrl = "https://portal.packzy.com/api/v1";

type SteadfastRequest = {
  body?: unknown;
  method: "GET" | "POST";
  path: string;
  retry?: boolean;
};

/**
 * Steadfast answers HTTP 200 with its own `status` field in the envelope, so a
 * transport-level success is not the same as an application-level one — both
 * are checked here before an adapter ever sees the payload.
 */
export async function steadfastRequest<T extends Record<string, unknown>>(
  context: CourierContext,
  request: SteadfastRequest
) {
  const apiKey = context.credentials.apiKey?.trim();
  const secretKey = context.credentials.secretKey?.trim();

  if (!apiKey || !secretKey) {
    throw new CourierError("AUTH", "Steadfast API key and secret key are both required.");
  }

  const { data } = await courierRequest<T>({
    baseUrl: context.credentials.baseUrl?.trim() || steadfastDefaultBaseUrl,
    headers: {
      "Api-Key": apiKey,
      "Secret-Key": secretKey
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

function assertEnvelopeOk(data: unknown) {
  if (!data || typeof data !== "object") {
    throw new CourierError("PROVIDER_DOWN", "The courier returned an unreadable response.");
  }

  const record = data as Record<string, unknown>;
  const status = typeof record.status === "number" ? record.status : null;

  if (status === null || status < 400) {
    return;
  }

  const message = typeof record.message === "string" && record.message.trim()
    ? record.message.trim()
    : `The courier rejected the request (status ${status}).`;

  if (status === 401 || status === 403) {
    throw new CourierError("AUTH", message, { status });
  }

  if (status === 404) {
    throw new CourierError("NOT_FOUND", message, { status });
  }

  if (status === 429) {
    throw new CourierError("RATE_LIMIT", message, { status });
  }

  if (status >= 500) {
    throw new CourierError("PROVIDER_DOWN", message, { status });
  }

  throw new CourierError("VALIDATION", message, { status });
}
