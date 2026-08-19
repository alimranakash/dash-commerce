import "../../lib/env";

/**
 * Everything the transports read from the environment, in one place.
 *
 * Both channels return `null` rather than throwing when unset. An install with
 * no mail host and no SMS account still has to run — the service falls back to
 * writing codes to the server log, which is the same courtesy the StoreOS
 * client extends when its own credentials are missing.
 */

export const smsProviderKeys = ["alpha"] as const;

export type SmsProviderKey = (typeof smsProviderKeys)[number];

export type SmtpSettings = {
  from: string;
  host: string;
  password: string;
  port: number;
  /** Implicit TLS on 465; everything else negotiates STARTTLS. */
  secure: boolean;
  user: string;
};

export type AlphaSmsSettings = {
  apiKey: string;
  /** Needs prior approval from the gateway; sends go out unbranded without it. */
  senderId: string | null;
};

export function readSmtpSettings(): SmtpSettings | null {
  const host = trimmed(process.env.SMTP_HOST);
  const user = trimmed(process.env.SMTP_USER);
  const password = trimmed(process.env.SMTP_PASSWORD);

  if (!host || !user || !password) {
    return null;
  }

  const port = Number.parseInt(trimmed(process.env.SMTP_PORT) ?? "587", 10);
  const resolvedPort = Number.isFinite(port) && port > 0 ? port : 587;

  return {
    // Falling back to the SMTP username is right far more often than it is
    // wrong: most relays require the From address to be one they authenticated.
    from: trimmed(process.env.EMAIL_FROM) ?? user,
    host,
    password,
    port: resolvedPort,
    secure: trimmed(process.env.SMTP_SECURE)?.toLowerCase() === "true" || resolvedPort === 465,
    user
  };
}

export function readAlphaSmsSettings(): AlphaSmsSettings | null {
  const apiKey = trimmed(process.env.ALPHA_SMS_API_KEY);

  if (!apiKey) {
    return null;
  }

  return {
    apiKey,
    senderId: trimmed(process.env.SMS_SENDER_ID) ?? null
  };
}

export function readSmsProviderKey(): SmsProviderKey {
  const configured = trimmed(process.env.SMS_PROVIDER)?.toLowerCase();

  return smsProviderKeys.find((key) => key === configured) ?? "alpha";
}

function trimmed(value: string | undefined) {
  const result = value?.trim();

  return result ? result : undefined;
}
