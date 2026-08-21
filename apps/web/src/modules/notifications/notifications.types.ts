export type MessageChannel = "EMAIL" | "SMS";
export type MessageDeliveryStatus = "BLOCKED" | "FAILED" | "SENT" | "SKIPPED";

/**
 * Every kind of message the platform can send. Adding one means adding a
 * template beside it — the key is what the delivery log is searched by when
 * someone asks "did the invite go out".
 */
export type MessageTemplateKey = "order_confirmation" | "order_custom" | "otp_code";

export type MessageDeliveryOutcome = {
  provider: string;
  providerMessageId: string | null;
  /** `SKIPPED` means nothing was configured and the message went to the log. */
  status: MessageDeliveryStatus;
};
