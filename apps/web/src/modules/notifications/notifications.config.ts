import "../../lib/env";
import { decryptSecret } from "../../lib/secret-box";
import { getMessagingSettingRecord } from "./messaging-settings.repository";

/**
 * Where the transports get their credentials.
 *
 * Two sources, in a deliberate order: whatever an admin saved in the panel
 * first, and the matching environment variable behind it. A deployment that was
 * configured through `.env` therefore keeps working untouched until someone
 * saves a value in the panel, and nothing has to be migrated.
 *
 * Both resolvers return `null` rather than throwing when nothing is set. An
 * install with no mail host and no SMS account still has to run — the service
 * falls back to writing codes to the server log, which is the same courtesy the
 * StoreOS client extends when its own credentials are missing.
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

export type SmsCredentials = {
  apiKey: string;
  /** Needs prior approval from the gateway; sends go out unbranded without it. */
  senderId: string | null;
};

export type MessagingConfig = {
  email: SmtpSettings | null;
  sms: { credentials: SmsCredentials; provider: SmsProviderKey } | null;
};

/**
 * The platform's one gateway. Everything goes through it — the platform's own
 * codes and every message a store sends. Resolved once per send and handed down, so a single message
 * never reads the settings row twice and an adapter never reaches for
 * configuration itself.
 */
export async function resolveMessagingConfig(): Promise<MessagingConfig> {
  const record = await getMessagingSettingRecord().catch(() => null);

  return {
    email: record?.emailEnabled === false ? null : readSmtpSettings(record),
    sms: record?.smsEnabled === false ? null : readSmsSettings(record)
  };
}

type MessagingRecord = Awaited<ReturnType<typeof getMessagingSettingRecord>>;

function readSmtpSettings(record: MessagingRecord): SmtpSettings | null {
  const host = trimmed(record?.smtpHost) ?? trimmed(process.env.SMTP_HOST);
  const user = trimmed(record?.smtpUser) ?? trimmed(process.env.SMTP_USER);
  const password = openSecret(record?.smtpPasswordCipher) ?? trimmed(process.env.SMTP_PASSWORD);

  if (!host || !user || !password) {
    return null;
  }

  // Implicit TLS decides the default port rather than the other way round. 465
  // speaks TLS from the first byte and 587 negotiates it after a plaintext
  // greeting, so a blank port field defaulting to 587 while implicit TLS is on
  // fails the handshake outright — OpenSSL calls it "wrong version number",
  // which names a record header instead of the setting that caused it.
  const wantsImplicitTls =
    record?.smtpSecure === true || trimmed(process.env.SMTP_SECURE)?.toLowerCase() === "true";
  const port =
    readPort(record?.smtpPort) ??
    readPort(trimmed(process.env.SMTP_PORT)) ??
    (wantsImplicitTls ? 465 : 587);

  return {
    // Falling back to the SMTP username is right far more often than it is
    // wrong: most relays require the From address to be one they authenticated.
    from: trimmed(record?.emailFrom) ?? trimmed(process.env.EMAIL_FROM) ?? user,
    host,
    password,
    port,
    secure: wantsImplicitTls || port === 465,
    user
  };
}

function readSmsSettings(record: MessagingRecord): MessagingConfig["sms"] {
  const apiKey = openSecret(record?.smsApiKeyCipher) ?? trimmed(process.env.ALPHA_SMS_API_KEY);

  if (!apiKey) {
    return null;
  }

  return {
    credentials: {
      apiKey,
      senderId: trimmed(record?.smsSenderId) ?? trimmed(process.env.SMS_SENDER_ID) ?? null
    },
    provider: toProviderKey(trimmed(record?.smsProvider) ?? trimmed(process.env.SMS_PROVIDER))
  };
}

function readPort(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return undefined;
  }

  const port = typeof value === "number" ? value : Number.parseInt(value, 10);

  return Number.isFinite(port) && port > 0 && port <= 65535 ? port : undefined;
}

function toProviderKey(value: string | undefined): SmsProviderKey {
  const normalized = value?.toLowerCase();

  return smsProviderKeys.find((key) => key === normalized) ?? "alpha";
}

/**
 * A stored secret that will not decrypt is treated as absent rather than fatal:
 * the encryption key has probably been rotated or lost, and the environment
 * fallback behind it is a better answer than refusing to send anything at all.
 */
function openSecret(cipher: string | null | undefined) {
  if (!cipher) {
    return undefined;
  }

  try {
    return trimmed(decryptSecret(cipher) ?? undefined);
  } catch {
    console.error("A stored messaging secret could not be decrypted — falling back to the environment.");

    return undefined;
  }
}

function trimmed(value: string | null | undefined) {
  const result = value?.trim();

  return result ? result : undefined;
}
