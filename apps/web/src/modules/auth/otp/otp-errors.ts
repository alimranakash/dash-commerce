/**
 * Why a code could not be sent or accepted.
 *
 * Nothing above this layer branches on Prisma errors or clock arithmetic — the
 * routes turn a `code` into an HTTP status and the form turns it into a
 * sentence, so the two never drift apart.
 */

export type OtpErrorCode =
  | "ALREADY_REGISTERED"
  | "CHALLENGE_NOT_FOUND"
  | "COOLDOWN"
  | "DELIVERY_FAILED"
  | "EXPIRED"
  | "INVALID_CODE"
  | "INVALID_IDENTIFIER"
  | "RESEND_LIMIT"
  | "TOO_MANY_ATTEMPTS"
  | "TOO_MANY_REQUESTS";

type OtpErrorOptions = {
  /** Attempts left before the challenge is burned, for `INVALID_CODE` only. */
  attemptsRemaining?: number;
  cause?: unknown;
  /** How long until the same request would be accepted, for the throttles. */
  retryAfterSeconds?: number;
};

export class OtpError extends Error {
  readonly attemptsRemaining: number | undefined;
  readonly code: OtpErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: OtpErrorCode, message: string, options: OtpErrorOptions = {}) {
    super(message, ...(options.cause !== undefined ? [{ cause: options.cause }] : []));

    this.attemptsRemaining = options.attemptsRemaining;
    this.code = code;
    this.name = "OtpError";
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}

export function isOtpError(value: unknown): value is OtpError {
  return value instanceof OtpError;
}

/**
 * 429 for the throttles so a client can honour `Retry-After`; 410 for a
 * challenge that is gone rather than wrong, which is the difference between
 * "type it again" and "ask for a new code".
 */
export function otpErrorStatus(code: OtpErrorCode) {
  switch (code) {
    case "COOLDOWN":
    case "RESEND_LIMIT":
    case "TOO_MANY_REQUESTS":
      return 429;
    case "CHALLENGE_NOT_FOUND":
    case "EXPIRED":
    case "TOO_MANY_ATTEMPTS":
      return 410;
    // The visitor did nothing wrong and retrying is the right move, which is
    // what a gateway failure means and what 502 already says.
    case "DELIVERY_FAILED":
      return 502;
    default:
      return 400;
  }
}
