import { CourierError } from "./courier-errors";

/**
 * The single outbound fetch used by every provider adapter.
 *
 * Three jobs: enforce a hard timeout, translate transport and status failures
 * into the CourierError taxonomy, and make sure nothing secret is ever handed
 * back for storage or logging.
 *
 * Retry policy is opt-in per call and capped at one extra attempt. Adapters pass
 * `retry: true` for idempotent reads only — a retried `create_order` is a second
 * real parcel, so booking calls never set it.
 */

export const COURIER_TIMEOUT_MS = 12_000;

const redactedHeaderNames = new Set(["api-key", "authorization", "secret-key"]);
const redactedBodyKeys = new Set([
  "api_key",
  "apikey",
  "authorization",
  "clientsecret",
  "client_secret",
  "password",
  "secret",
  "secret_key",
  "secretkey",
  "token"
]);

export type CourierRequestInit = {
  baseUrl: string;
  body?: unknown;
  headers?: Record<string, string>;
  method: "GET" | "POST";
  path: string;
  retry?: boolean;
  timeoutMs?: number;
};

export type CourierResponse<T> = {
  data: T;
  status: number;
};

export async function courierRequest<T>(request: CourierRequestInit): Promise<CourierResponse<T>> {
  const attempts = request.retry ? 2 : 1;
  let lastError: CourierError | null = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await sendOnce<T>(request);
    } catch (error) {
      const courierError = error instanceof CourierError ? error : new CourierError("UNKNOWN", "Unexpected courier transport error.", { cause: error });

      if (!courierError.retryable || attempt === attempts - 1) {
        throw courierError;
      }

      lastError = courierError;
    }
  }

  throw lastError ?? new CourierError("UNKNOWN", "Courier request failed.");
}

async function sendOnce<T>(request: CourierRequestInit): Promise<CourierResponse<T>> {
  const url = `${request.baseUrl.replace(/\/+$/, "")}/${request.path.replace(/^\/+/, "")}`;
  const timeoutMs = request.timeoutMs ?? COURIER_TIMEOUT_MS;

  let response: Response;

  try {
    response = await fetch(url, {
      cache: "no-store",
      method: request.method,
      signal: AbortSignal.timeout(timeoutMs),
      ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...request.headers
      }
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new CourierError("TIMEOUT", `The courier did not respond within ${timeoutMs / 1000}s.`, {
        cause: error
      });
    }

    throw new CourierError("PROVIDER_DOWN", "Could not reach the courier's API.", { cause: error });
  }

  const text = await response.text();
  const data = parseJson(text);

  if (!response.ok) {
    throw statusError(response.status, data, text);
  }

  return { data: data as T, status: response.status };
}

function statusError(status: number, data: unknown, text: string) {
  const message = extractMessage(data) ?? `The courier returned HTTP ${status}.`;
  // Carried on every kind, not just VALIDATION: an auth or not-found body can
  // name a field too, and dropping it here is what produced the useless
  // "Please fix the given errors" with no indication of what to fix.
  const details = extractFieldErrors(data);

  if (status === 401 || status === 403) {
    return new CourierError("AUTH", message, { details, status });
  }

  if (status === 422 || status === 400) {
    return new CourierError("VALIDATION", message, { details, status });
  }

  // Distinguished from UNKNOWN on purpose: only an explicit not-found lets
  // timeout reconciliation conclude that no parcel was ever created.
  if (status === 404) {
    return new CourierError("NOT_FOUND", message, { details, status });
  }

  if (status === 429) {
    return new CourierError("RATE_LIMIT", message, { details, status });
  }

  if (status >= 500) {
    return new CourierError("PROVIDER_DOWN", message, { details, status });
  }

  return new CourierError("UNKNOWN", message || text.slice(0, 200), { details, status });
}

/**
 * Pulls `{ errors: { field: ["reason"] } }` into `field: reason` strings.
 *
 * Both carriers are Laravel apps, so this validation-error shape is shared — one
 * generic extractor keeps every adapter's field errors visible without each
 * having to remember to do it.
 */
export function extractFieldErrors(data: unknown): string[] {
  if (!data || typeof data !== "object") {
    return [];
  }

  const errors = (data as Record<string, unknown>).errors;

  if (!errors || typeof errors !== "object" || Array.isArray(errors)) {
    return [];
  }

  return Object.entries(errors as Record<string, unknown>)
    .map(([field, value]) => {
      const reason = Array.isArray(value)
        ? value.filter((entry): entry is string => typeof entry === "string").join(", ")
        : typeof value === "string"
          ? value
          : "";

      return reason ? `${field} — ${reason.replace(/\s{2,}/g, " ").trim()}` : "";
    })
    .filter((entry) => entry.length > 0);
}

function parseJson(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractMessage(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  const message = record.message ?? record.error ?? record.errors;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  if (message && typeof message === "object") {
    const first = Object.values(message as Record<string, unknown>)[0];

    if (typeof first === "string") {
      return first;
    }

    if (Array.isArray(first) && typeof first[0] === "string") {
      return first[0];
    }
  }

  return null;
}

export function redactHeaders(headers: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      redactedHeaderNames.has(key.toLowerCase()) ? "[redacted]" : value
    ])
  );
}

/**
 * Applied to anything on its way into `Shipment.rawResponse` or a system log.
 * Carriers echo request fields back, so a response is not automatically safe.
 */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactSecrets(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      redactedBodyKeys.has(key.toLowerCase().replace(/-/g, "_")) ? "[redacted]" : redactSecrets(entry)
    ])
  );
}
