import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import "./env";

/**
 * AES-256-GCM at rest for anything the server must be able to read back but no
 * client may ever see: carrier API secrets, the Meta Conversions API token.
 *
 * The stored string is self-describing (`v1.iv.tag.ciphertext`, all base64) so a
 * future key rotation or algorithm change can be detected rather than guessed.
 *
 * Key resolution deliberately prefers COURIER_CREDENTIALS_KEY: that is the key
 * that already encrypted live CourierAccount rows, so adding the more general
 * SECRETS_ENCRYPTION_KEY to an existing deployment must not silently orphan
 * them. New installs can set either name.
 */

const cipherVersion = "v1";
const algorithm = "aes-256-gcm";
const ivLength = 12;
const keyLength = 32;

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SecretBoxError";
  }
}

export function isSecretEncryptionConfigured() {
  return readKey() !== null;
}

export function requireSecretEncryptionKey() {
  const key = readKey();

  if (!key) {
    throw new SecretBoxError(
      "COURIER_CREDENTIALS_KEY (or SECRETS_ENCRYPTION_KEY) is missing or invalid. Generate a 32-byte base64 key and add it to the root .env before saving secrets."
    );
  }

  return key;
}

/** Encrypts a single value — used for one-off tokens. */
export function encryptSecret(value: string) {
  return seal(value);
}

/** Returns null rather than throwing when nothing is stored. */
export function decryptSecret(value: string | null | undefined) {
  return value ? open(value) : null;
}

export function encryptSecretRecord(values: Record<string, string>) {
  return seal(JSON.stringify(values));
}

export function decryptSecretRecord(value: string | null | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  const parsed: unknown = JSON.parse(open(value));

  return isStringRecord(parsed) ? parsed : {};
}

/** Last four characters, so settings can prove which secret is stored. */
export function secretHintFor(value: string | undefined | null) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length >= 4 ? `••••${trimmed.slice(-4)}` : null;
}

/** Constant-time compare, for webhook bearer tokens. */
export function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

function seal(plain: string) {
  const key = requireSecretEncryptionKey();
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, key, iv);
  const payload = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);

  return [
    cipherVersion,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    payload.toString("base64")
  ].join(".");
}

function open(value: string) {
  const key = requireSecretEncryptionKey();
  const [version, ivPart, tagPart, payloadPart] = value.split(".");

  if (version !== cipherVersion || !ivPart || !tagPart || !payloadPart) {
    throw new SecretBoxError("The stored secret is in an unrecognised format.");
  }

  try {
    const decipher = createDecipheriv(algorithm, key, Buffer.from(ivPart, "base64"));

    decipher.setAuthTag(Buffer.from(tagPart, "base64"));

    return Buffer.concat([
      decipher.update(Buffer.from(payloadPart, "base64")),
      decipher.final()
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof SecretBoxError) {
      throw error;
    }

    // A GCM tag mismatch means the key changed or the row was tampered with.
    throw new SecretBoxError(
      "Could not decrypt a stored secret. The encryption key may have changed — re-enter the affected credentials in settings."
    );
  }
}

function readKey() {
  const raw = (process.env.COURIER_CREDENTIALS_KEY ?? process.env.SECRETS_ENCRYPTION_KEY)?.trim();

  if (!raw) {
    return null;
  }

  try {
    const key = Buffer.from(raw, "base64");

    return key.length === keyLength ? key : null;
  } catch {
    return null;
  }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}
