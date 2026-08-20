import { getSmsAllowance } from "../billing/subscription-limits";
import { sendSmtpEmail } from "./email-transport";
import { isNotificationError, toNotificationError } from "./notifications-errors";
import { resolveMessagingConfig, type MessagingConfig } from "./notifications.config";
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
 * Three rules hold for both channels. An unconfigured install does not fail —
 * the message goes to the server log and is recorded as `SKIPPED`, which is what
 * lets sign-up be developed and tested before a mail host or an SMS balance
 * exists. Every attempt is written to `MessageDelivery` either way, because the
 * failure that costs the most time is the silent one. And every message says
 * which store it was sent for, or that it was sent for none.
 *
 * `storeId` is the difference between a seller's allowance and the platform's
 * own cost. A sign-up code or a password reset happens before any store is in
 * the picture and is the platform's to pay for; a checkout code is sent on a
 * seller's behalf and counts against their plan.
 */

export async function sendEmail(input: {
  html?: string;
  storeId?: string | null;
  subject: string;
  template: MessageTemplateKey;
  text: string;
  to: string;
}): Promise<MessageDeliveryOutcome> {
  const config = await resolveMessagingConfig();
  const settings = config.email;

  return deliver({
    channel: "EMAIL",
    preview: `${input.subject} — ${input.text.replace(/\s+/g, " ").slice(0, 200)}`,
    provider: "smtp",
    recipient: input.to,
    send: settings
      ? () =>
          sendSmtpEmail(
            {
              ...(input.html === undefined ? {} : { html: input.html }),
              subject: input.subject,
              text: input.text,
              to: input.to
            },
            settings
          )
      : null,
    storeId: input.storeId ?? null,
    template: input.template
  });
}

export async function sendSms(input: {
  message: string;
  storeId?: string | null;
  template: MessageTemplateKey;
  to: string;
}): Promise<MessageDeliveryOutcome> {
  const config = await resolveMessagingConfig();
  const storeId = input.storeId ?? null;
  const blocked = storeId === null ? null : await overAllowance(storeId);

  if (blocked) {
    console.warn(
      `[sms] store ${storeId} has used its plan's monthly SMS allowance (${blocked.used}/${blocked.limit}) — not sending.`
    );

    await log({
      channel: "SMS",
      errorCode: "PLAN_LIMIT",
      errorMessage: `The store's plan allows ${blocked.limit} SMS a month and ${blocked.used} have been sent.`,
      provider: config.sms?.provider ?? "none",
      providerMessageId: null,
      recipient: input.to,
      status: "BLOCKED",
      storeId,
      template: input.template
    });

    return { provider: config.sms?.provider ?? "none", providerMessageId: null, status: "BLOCKED" };
  }

  return deliver({
    channel: "SMS",
    preview: input.message,
    provider: config.sms?.provider ?? "none",
    recipient: input.to,
    send: sendWith(config, input),
    storeId,
    template: input.template
  });
}

function sendWith(config: MessagingConfig, input: { message: string; to: string }) {
  if (!config.sms) {
    return null;
  }

  const provider = getSmsProvider(config.sms.provider);
  const credentials = config.sms.credentials;

  return () => provider.send({ message: input.message, to: input.to }, credentials);
}

async function overAllowance(storeId: string) {
  const allowance = await getSmsAllowance(storeId);

  return allowance.remaining !== null && allowance.remaining <= 0
    ? { limit: allowance.limit, used: allowance.used }
    : null;
}

async function deliver(input: {
  channel: MessageChannel;
  /** Logged verbatim only when nothing is configured to send it. */
  preview: string;
  provider: string;
  recipient: string;
  send: (() => Promise<{ providerMessageId: string | null }>) | null;
  storeId: string | null;
  template: MessageTemplateKey;
}): Promise<MessageDeliveryOutcome> {
  const entry = {
    channel: input.channel,
    provider: input.provider,
    recipient: input.recipient,
    storeId: input.storeId,
    template: input.template
  };

  if (!input.send) {
    console.info(`[${input.channel.toLowerCase()}] to ${input.recipient}: ${input.preview}`);
    console.info(`[${input.channel.toLowerCase()}] nothing configured to send this — logged only.`);

    await log({ ...entry, errorCode: null, errorMessage: null, providerMessageId: null, status: "SKIPPED" });

    return { provider: input.provider, providerMessageId: null, status: "SKIPPED" };
  }

  try {
    const receipt = await input.send();

    await log({
      ...entry,
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
      ...entry,
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
  status: "BLOCKED" | "FAILED" | "SENT" | "SKIPPED";
  storeId: string | null;
  template: MessageTemplateKey;
}) {
  try {
    await recordMessageDelivery(entry);
  } catch (error) {
    console.error("Could not record a message delivery", error);
  }
}

export { isNotificationError };
