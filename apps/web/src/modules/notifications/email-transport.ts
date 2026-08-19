import { createTransport, type Transporter } from "nodemailer";
import { NotificationError } from "./notifications-errors";
import { readSmtpSettings, type SmtpSettings } from "./notifications.config";

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

export function isEmailConfigured() {
  return readSmtpSettings() !== null;
}

export function describeEmailTransport() {
  const settings = readSmtpSettings();

  return settings ? { from: settings.from, host: settings.host, port: settings.port } : null;
}

export async function sendSmtpEmail(input: {
  html?: string;
  subject: string;
  text: string;
  to: string;
}) {
  const settings = readSmtpSettings();

  if (!settings) {
    throw new NotificationError(
      "CONFIG",
      "SMTP_HOST, SMTP_USER and SMTP_PASSWORD have to be set before mail can be sent."
    );
  }

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
      return new NotificationError("TRANSPORT", `Could not reach the mail server: ${message}`, options);
    case "EENVELOPE":
      return new NotificationError("INVALID_RECIPIENT", `The mail server refused that address: ${message}`, options);
    default:
      return new NotificationError("UNKNOWN", message, options);
  }
}
