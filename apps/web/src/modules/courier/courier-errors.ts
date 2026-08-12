/**
 * The failure taxonomy every adapter translates its HTTP/JSON errors into.
 *
 * Nothing above the provider layer ever sees a fetch rejection, a status code or
 * a carrier's error envelope — the service and the UI only branch on `kind`.
 */

export type CourierErrorKind =
  | "AUTH"
  | "NOT_FOUND"
  | "PROVIDER_DOWN"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "UNKNOWN"
  | "VALIDATION";

type CourierErrorOptions = {
  cause?: unknown;
  /** Only ever true for reads. A create is never retried automatically. */
  retryable?: boolean;
  status?: number;
};

export class CourierError extends Error {
  readonly kind: CourierErrorKind;
  readonly retryable: boolean;
  readonly status: number | undefined;

  constructor(kind: CourierErrorKind, message: string, options: CourierErrorOptions = {}) {
    super(message, ...(options.cause !== undefined ? [{ cause: options.cause }] : []));

    this.name = "CourierError";
    this.kind = kind;
    this.retryable = options.retryable ?? defaultRetryable(kind);
    this.status = options.status;
  }
}

export function isCourierError(value: unknown): value is CourierError {
  return value instanceof CourierError;
}

/** Never let a raw exception escape the courier layer untyped. */
export function toCourierError(error: unknown) {
  if (isCourierError(error)) {
    return error;
  }

  const message = error instanceof Error ? error.message : "Unexpected courier error.";

  return new CourierError("UNKNOWN", message, { cause: error });
}

/**
 * Seller-facing copy. Deliberately actionable: an auth failure should send them
 * to settings, not leave them re-clicking a button that will never work.
 */
export function courierErrorMessage(error: CourierError) {
  switch (error.kind) {
    case "AUTH":
      // A 401/403 does not always mean "wrong keys" — Steadfast also answers
      // this way for an account that is not activated yet. Lead with whatever
      // the carrier actually said and only fall back to our own guess.
      return error.message.trim()
        ? `${error.message.trim()} (reported by the courier — check your credentials and account status in courier settings.)`
        : "The courier rejected these API credentials. Check them in courier settings.";
    case "NOT_FOUND":
      return error.message.trim() || "The courier has no record of that consignment.";
    case "RATE_LIMIT":
      return "Too many courier requests just now. Wait a moment and try again.";
    case "PROVIDER_DOWN":
      return "The courier's API is not responding. Nothing was booked — try again shortly.";
    case "TIMEOUT":
      return "The courier did not respond in time. The parcel may or may not have been created — use Refresh status to check before sending again.";
    case "VALIDATION":
      return error.message;
    default:
      return error.message || "Something went wrong talking to the courier.";
  }
}

function defaultRetryable(kind: CourierErrorKind) {
  return kind === "PROVIDER_DOWN" || kind === "TIMEOUT";
}
