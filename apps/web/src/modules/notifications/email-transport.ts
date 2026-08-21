import { createTransport, type Transporter } from "nodemailer";
import { NotificationError } from "./notifications-errors";
import type { SmtpSettings } from "./notifications.config";

/**
 * Plain SMTP, deliberately.
 *
 * Every transactional host worth using speaks it, so the mail provider is four
 * environment variables rather than a dependency — an install can start on a
 * free relay and move to a paid one without a line of code changing.
 *
 * What no transport can do for you: without SPF and DKIM published for the
 * sending domain, verification mail lands in spam and sign-up quietly stops
 * working. That is DNS, and it has to be done wherever the domain lives.
 */

let cached: { key: string; transporter: Transporter } | null = null;

export async function sendSmtpEmail(
  input: {
    html?: string;
    subject: string;
    text: string;
    to: string;
  },
  settings: SmtpSettings
) {
  try {
    const receipt = await resolveTransporter(settings).sendMail({
      from: settings.from,
      ...(input.html === undefined ? {} : { html: input.html }),
      subject: input.subject,
      text: input.text,
      to: input.to
    });

    return { providerMessageId: receipt.messageId ?? null };
  } catch (error) {
    throw describeSmtpError(error);
  }
}

/**
 * One pooled connection per configuration. Re-created only when the settings
 * change, so a dev hot reload does not leave sockets open to the relay.
 */
function resolveTransporter(settings: SmtpSettings) {
  const key = `${settings.host}:${settings.port}:${settings.secure}:${settings.user}`;

  if (cached?.key !== key) {
    cached = {
      key,
      transporter: createTransport({
        auth: {
          pass: settings.password,
          user: settings.user
        },
        host: settings.host,
        pool: true,
        port: settings.port,
        secure: settings.secure
      })
    };
  }

  return cached.transporter;
}

/**
 * A TLS handshake against a STARTTLS port fails deep inside OpenSSL, and what
 * it reports is a malformed record header — true, and useless to whoever has to
 * fix it. This is the one SMTP misconfiguration an admin cannot guess from the
 * message they are shown, so it gets named.
 */
function transportMessage(message: string) {
  return /wrong version number|packet length too long|SSL routines/i.test(message)
    ? `The TLS setting does not match the port: use implicit TLS on 465, or turn it off for STARTTLS on 587. (${message})`
    : `Could not reach the mail server: ${message}`;
}

function describeSmtpError(error: unknown) {
  const code =
    typeof error === "object" && error !== null ? String((error as { code?: unknown }).code ?? "") : "";
  const message = error instanceof Error ? error.message : "The mail server rejected the message.";
  const options = { cause: error, ...(code ? { providerCode: code } : {}) };

  switch (code) {
    case "EAUTH":
      return new NotificationError("AUTH", `The mail server rejected these credentials: ${message}`, options);
    case "ECONNECTION":
    case "ESOCKET":
    case "ETIMEDOUT":
      return new NotificationError("TRANSPORT", transportMessage(message), options);
    case "EENVELOPE":
      return new NotificationError("INVALID_RECIPIENT", `The mail server refused that address: ${message}`, options);
    default:
      return new NotificationError("UNKNOWN", message, options);
  }
}
