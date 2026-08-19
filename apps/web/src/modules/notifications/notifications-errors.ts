/**
 * Why a message could not be handed to a gateway.
 *
 * The split that matters is `outage`: a bad phone number is one visitor's
 * problem, but an empty SMS balance or a rejected API key stops registration
 * for everybody at once. Those must be loud in the log and visible in admin —
 * the worst version of this failure is the quiet one.
 */

export type NotificationErrorKind =
  | "AUTH"
  | "BLOCKED"
  | "CONFIG"
  | "INVALID_RECIPIENT"
  | "NO_BALANCE"
  | "RESTRICTED"
  | "TRANSPORT"
  | "UNKNOWN";

type NotificationErrorOptions = {
  cause?: unknown;
  /** The gateway's own code, kept verbatim for the delivery log. */
  providerCode?: string;
};

export class NotificationError extends Error {
  readonly kind: NotificationErrorKind;
  readonly providerCode: string | undefined;

  constructor(kind: NotificationErrorKind, message: string, options: NotificationErrorOptions = {}) {
    super(message, ...(options.cause !== undefined ? [{ cause: options.cause }] : []));

    this.kind = kind;
    this.name = "NotificationError";
    this.providerCode = options.providerCode;
  }

  /** True when this breaks sending for everyone, not just this recipient. */
  get isOutage() {
    return this.kind === "AUTH" || this.kind === "CONFIG" || this.kind === "NO_BALANCE";
  }
}

export function isNotificationError(value: unknown): value is NotificationError {
  return value instanceof NotificationError;
}

export function toNotificationError(error: unknown) {
  if (isNotificationError(error)) {
    return error;
  }

  return new NotificationError(
    "UNKNOWN",
    error instanceof Error ? error.message : "The message could not be sent.",
    { cause: error }
  );
}
