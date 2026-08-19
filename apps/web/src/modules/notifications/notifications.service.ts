import { isEmailConfigured, sendSmtpEmail } from "./email-transport";
import { isNotificationError, toNotificationError } from "./notifications-errors";
import { recordMessageDelivery } from "./notifications.repository";
import type {
  MessageChannel,
  MessageDeliveryOutcome,
  MessageTemplateKey
} from "./notifications.types";
import { getSmsProvider } from "./sms/registry";

/**
 * The one way anything in this app sends a message.
 *
 * Two rules hold for both channels. An unconfigured install does not fail — the
 * message goes to the server log and is recorded as `SKIPPED`, which is what
 * lets sign-up be developed and tested before a mail host or an SMS balance
 * exists. And every attempt is written to `MessageDelivery` either way, because
 * the failure that costs the most time is the silent one.
 */

export async function sendEmail(input: {
  html?: string;
  subject: string;
  template: MessageTemplateKey;
  text: string;
  to: string;
}): Promise<MessageDeliveryOutcome> {
  return deliver({
    channel: "EMAIL",
    preview: `${input.subject} — ${input.text.replace(/\s+/g, " ").slice(0, 200)}`,
    provider: "smtp",
    recipient: input.to,
    send: isEmailConfigured()
      ? () =>
          sendSmtpEmail({
            ...(input.html === undefined ? {} : { html: input.html }),
            subject: input.subject,
            text: input.text,
            to: input.to
          })
      : null,
    template: input.template
  });
}

export async function sendSms(input: {
  message: string;
  template: MessageTemplateKey;
  to: string;
}): Promise<MessageDeliveryOutcome> {
  const provider = getSmsProvider();

  return deliver({
    channel: "SMS",
    preview: input.message,
    provider: provider.key,
    recipient: input.to,
    send: provider.isConfigured() ? () => provider.send({ message: input.message, to: input.to }) : null,
    template: input.template
  });
}

async function deliver(input: {
  channel: MessageChannel;
  /** Logged verbatim only when nothing is configured to send it. */
  preview: string;
  provider: string;
  recipient: string;
  send: (() => Promise<{ providerMessageId: string | null }>) | null;
  template: MessageTemplateKey;
}): Promise<MessageDeliveryOutcome> {
  if (!input.send) {
    console.info(`[${input.channel.toLowerCase()}] to ${input.recipient}: ${input.preview}`);
    console.info(`[${input.channel.toLowerCase()}] nothing configured to send this — logged only.`);

    await log({ ...input, errorCode: null, errorMessage: null, providerMessageId: null, status: "SKIPPED" });

    return { provider: input.provider, providerMessageId: null, status: "SKIPPED" };
  }

  try {
    const receipt = await input.send();

    await log({
      ...input,
      errorCode: null,
      errorMessage: null,
      providerMessageId: receipt.providerMessageId,
      status: "SENT"
    });

    return { provider: input.provider, providerMessageId: receipt.providerMessageId, status: "SENT" };
  } catch (error) {
    const failure = toNotificationError(error);

    // An outage stops every visitor at once, so it gets the loud line. A refused
    // recipient is one person's problem and stays at warning.
    if (failure.isOutage) {
      console.error(
        `[${input.channel.toLowerCase()}] SENDING IS DOWN (${failure.kind}): ${failure.message}`
      );
    } else {
      console.warn(`[${input.channel.toLowerCase()}] to ${input.recipient} failed: ${failure.message}`);
    }

    await log({
      ...input,
      errorCode: failure.providerCode ?? failure.kind,
      errorMessage: failure.message.slice(0, 500),
      providerMessageId: null,
      status: "FAILED"
    });

    throw failure;
  }
}

/**
 * Never the reason a message fails. A delivery that went out but could not be
 * written down is worth a log line, not an error handed back to the caller.
 */
async function log(entry: {
  channel: MessageChannel;
  errorCode: string | null;
  errorMessage: string | null;
  provider: string;
  providerMessageId: string | null;
  recipient: string;
  status: "FAILED" | "SENT" | "SKIPPED";
  template: MessageTemplateKey;
}) {
  try {
    await recordMessageDelivery({
      channel: entry.channel,
      errorCode: entry.errorCode,
      errorMessage: entry.errorMessage,
      provider: entry.provider,
      providerMessageId: entry.providerMessageId,
      recipient: entry.recipient,
      status: entry.status,
      template: entry.template
    });
  } catch (error) {
    console.error("Could not record a message delivery", error);
  }
}

export { isNotificationError };
