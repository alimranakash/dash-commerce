import { encryptSecret, isSecretEncryptionConfigured, requireSecretEncryptionKey } from "../../lib/secret-box";
import {
  getMessagingSettingRecord,
  saveMessagingSettingRecord
} from "./messaging-settings.repository";
import { smsProviderKeys, type SmsProviderKey } from "./notifications.config";

/**
 * Reading and writing the platform's gateway credentials from the admin panel.
 *
 * Two rules make this safe to put behind a web form. A secret is encrypted with
 * the same key as courier credentials and is **never sent back to the browser**
 * — the panel gets a four-character hint instead, which is enough to tell one
 * key from another and useless to anyone who sees it. And a blank secret field
 * means "leave what is there", so an admin editing the sender ID does not have
 * to re-paste an API key they may not have to hand.
 */

export type MessagingSettingsView = {
  emailEnabled: boolean;
  emailFrom: string;
  /** True when `.env` would supply this channel if the panel is left blank. */
  environmentFallback: { email: boolean; sms: boolean };
  secretsStorable: boolean;
  smsApiKeyHint: string | null;
  smsEnabled: boolean;
  smsProvider: SmsProviderKey;
  smsSenderId: string;
  smtpHost: string;
  smtpPasswordHint: string | null;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
};

export async function getMessagingSettingsView(): Promise<MessagingSettingsView> {
  const record = await getMessagingSettingRecord();

  return {
    emailEnabled: record?.emailEnabled ?? true,
    emailFrom: record?.emailFrom ?? "",
    environmentFallback: {
      email: Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim()),
      sms: Boolean(process.env.ALPHA_SMS_API_KEY?.trim())
    },
    secretsStorable: isSecretEncryptionConfigured(),
    smsApiKeyHint: record?.smsApiKeyHint ?? null,
    smsEnabled: record?.smsEnabled ?? true,
    smsProvider: toProviderKey(record?.smsProvider),
    smsSenderId: record?.smsSenderId ?? "",
    smtpHost: record?.smtpHost ?? "",
    smtpPasswordHint: record?.smtpPasswordHint ?? null,
    smtpPort: record?.smtpPort === null || record?.smtpPort === undefined ? "" : String(record.smtpPort),
    smtpSecure: record?.smtpSecure ?? false,
    smtpUser: record?.smtpUser ?? ""
  };
}

export async function saveMessagingSettings(input: {
  emailEnabled: boolean;
  emailFrom: string;
  smsApiKey: string;
  smsEnabled: boolean;
  smsProvider: string;
  smsSenderId: string;
  smtpHost: string;
  smtpPassword: string;
  smtpPort: string;
  smtpSecure: boolean;
  smtpUser: string;
}) {
  const existing = await getMessagingSettingRecord();
  const smsApiKey = input.smsApiKey.trim();
  const smtpPassword = input.smtpPassword.trim();

  if ((smsApiKey || smtpPassword) && !isSecretEncryptionConfigured()) {
    // Better to refuse than to write a credential in the clear. The message
    // names the variable, because that is the only thing standing in the way.
    requireSecretEncryptionKey();
  }

  const port = Number.parseInt(input.smtpPort.trim(), 10);

  return saveMessagingSettingRecord({
    emailEnabled: input.emailEnabled,
    emailFrom: blankToNull(input.emailFrom),
    // Absent keys are left alone rather than cleared, so editing one field does
    // not silently drop a credential the admin did not retype.
    ...(smsApiKey
      ? { smsApiKeyCipher: encryptSecret(smsApiKey), smsApiKeyHint: hint(smsApiKey) }
      : existing
        ? {}
        : { smsApiKeyCipher: null, smsApiKeyHint: null }),
    smsEnabled: input.smsEnabled,
    smsProvider: toProviderKey(input.smsProvider),
    smsSenderId: blankToNull(input.smsSenderId),
    smtpHost: blankToNull(input.smtpHost),
    ...(smtpPassword
      ? { smtpPasswordCipher: encryptSecret(smtpPassword), smtpPasswordHint: hint(smtpPassword) }
      : existing
        ? {}
        : { smtpPasswordCipher: null, smtpPasswordHint: null }),
    smtpPort: Number.isFinite(port) && port > 0 ? port : null,
    smtpSecure: input.smtpSecure,
    smtpUser: blankToNull(input.smtpUser)
  });
}

/** Clears a stored secret outright, for a key that has been revoked. */
export async function clearMessagingSecret(channel: "EMAIL" | "SMS") {
  const existing = await getMessagingSettingRecord();

  if (!existing) {
    return null;
  }

  return saveMessagingSettingRecord({
    emailEnabled: existing.emailEnabled,
    emailFrom: existing.emailFrom,
    smsEnabled: existing.smsEnabled,
    smsProvider: existing.smsProvider,
    smsSenderId: existing.smsSenderId,
    smtpHost: existing.smtpHost,
    smtpPort: existing.smtpPort,
    smtpSecure: existing.smtpSecure,
    smtpUser: existing.smtpUser,
    ...(channel === "SMS"
      ? { smsApiKeyCipher: null, smsApiKeyHint: null }
      : { smtpPasswordCipher: null, smtpPasswordHint: null })
  });
}

/** Enough to tell one key from another, not enough to be one. */
function hint(secret: string) {
  return secret.length <= 4 ? "••••" : `••••${secret.slice(-4)}`;
}

function blankToNull(value: string) {
  const trimmed = value.trim();

  return trimmed ? trimmed : null;
}

function toProviderKey(value: string | null | undefined): SmsProviderKey {
  const normalized = value?.trim().toLowerCase();

  return smsProviderKeys.find((key) => key === normalized) ?? "alpha";
}
