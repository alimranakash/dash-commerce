import { getSmsAllowance } from "../billing/subscription-limits";
import { sendSmtpEmail } from "./email-transport";
import { isNotificationError, toRedactedNotificationError } from "./notifications-errors";
import { resolveMessagingConfig, type MessagingConfig } from "./notifications.config";
import {
  errorForLog,
  maskRecipient,
  previewForLog,
  redactDeliveryRow,
  redactLogText
} from "./notifications.redact";
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
 * the message is recorded as `SKIPPED` and a redacted line goes to the server
 * log, never a code or a full recipient (see `notifications.redact`). Sign-up
 * can still be developed before a mail host or an SMS balance exists, because a
 * development build echoes the code to the browser instead (`otp-delivery`); a
 * production build with nothing configured has no way to hand anyone a code.
 * Every attempt is written to `MessageDelivery` either way, because the
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
    secrets: settings ? [settings.password] : [],
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
  const storeId = input.storeId ?? null;
  const config = await resolveMessagingConfig();
  // Store messages come out of the platform's gateway, so the plan allowance is
  // the only thing standing between one seller and everyone else's budget.
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
    secrets: config.sms ? [config.sms.credentials.apiKey] : [],
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
  /** Logged, through `previewForLog`, only when nothing is configured to send it. */
  preview: string;
  provider: string;
  recipient: string;
  /** The credentials this send uses, struck from anything the gateway says back. */
  secrets: readonly string[];
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
    console.info(
      `[${input.channel.toLowerCase()}] ${input.template} to ${maskRecipient(input.recipient)}: ${previewForLog(input.template, input.preview)}`
    );
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
    // Redacted once, here, before the failure is logged, persisted or handed
    // back — and handed back without the original as its cause. A gateway or a
    // proxy in front of it can echo the request, key and code included, and
    // callers show this message to admins and to sellers, who are not the ones
    // holding the platform's key.
    const failure = toRedactedNotificationError(error, input.secrets);

    // An outage stops every visitor at once, so it gets the loud line. A refused
    // recipient is one person's problem and stays at warning.
    if (failure.isOutage) {
      console.error(
        `[${input.channel.toLowerCase()}] SENDING IS DOWN (${failure.kind}): ${redactLogText(failure.message)}`
      );
    } else {
      // Masked: some messages only go to a number for a reason — a loyalty code
      // only to a member's — so a full recipient in the server log would say
      // more than that a send failed. The gateway's own words are redacted too,
      // since a reply can echo the number or the message back.
      console.warn(
        `[${input.channel.toLowerCase()}] to ${maskRecipient(input.recipient)} failed: ${redactLogText(failure.message)}`
      );
    }

    await log({
      ...entry,
      errorCode: failure.providerCode ?? failure.kind,
      errorMessage: failure.message,
      providerMessageId: null,
      status: "FAILED"
    });

    throw failure;
  }
}

/**
 * Never the reason a message fails. A delivery that went out but could not be
 * written down is worth a log line, not an error handed back to the caller.
 *
 * Every row is written through `redactDeliveryRow`, whichever path produced
 * it: the recipient masked to its last three characters, the error code and
 * message redacted (again, for the paths that did not redact them already).
 * Nothing reads a row back by recipient — the store's allowance counts by
 * store and status — so the full number has no reason to be kept.
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
    await recordMessageDelivery(redactDeliveryRow(entry));
  } catch (error) {
    console.error(`Could not record a message delivery: ${errorForLog(error)}`);
  }
}

export { isNotificationError };
