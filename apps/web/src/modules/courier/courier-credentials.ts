import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from "node:crypto";
import "../../lib/env";

/**
 * AES-256-GCM at rest for carrier API secrets.
 *
 * The stored string is self-describing (`v1.iv.tag.ciphertext`, all base64) so a
 * future key rotation or algorithm change can be detected rather than guessed.
 * Non-secret values (base URL, a carrier's own store id) are kept readable in
 * `CourierAccount.credentialsPublic` instead, so settings can show them back
 * without a decrypt.
 *
 * This replaces plaintext secrets in `StoreSetting.moduleSettings.courier`.
 */

const cipherVersion = "v1";
const algorithm = "aes-256-gcm";
const ivLength = 12;
const keyLength = 32;

export class CourierCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourierCredentialsError";
  }
}

export function isCourierEncryptionConfigured() {
  return readKey() !== null;
}

export function requireCourierEncryptionKey() {
  const key = readKey();

  if (!key) {
    throw new CourierCredentialsError(
      "COURIER_CREDENTIALS_KEY is missing or invalid. Generate a 32-byte base64 key and add it to the root .env before saving courier credentials."
    );
  }

  return key;
}

export function encryptCredentials(values: Record<string, string>) {
  const key = requireCourierEncryptionKey();
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv(algorithm, key, iv);
  const payload = Buffer.concat([
    cipher.update(JSON.stringify(values), "utf8"),
    cipher.final()
  ]);

  return [
    cipherVersion,
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    payload.toString("base64")
  ].join(".");
}

export function decryptCredentials(value: string | null | undefined): Record<string, string> {
  if (!value) {
    return {};
  }

  const key = requireCourierEncryptionKey();
  const [version, ivPart, tagPart, payloadPart] = value.split(".");

  if (version !== cipherVersion || !ivPart || !tagPart || !payloadPart) {
    throw new CourierCredentialsError("Stored courier credentials are in an unrecognised format.");
  }

  try {
    const decipher = createDecipheriv(algorithm, key, Buffer.from(ivPart, "base64"));

    decipher.setAuthTag(Buffer.from(tagPart, "base64"));

    const plain = Buffer.concat([
      decipher.update(Buffer.from(payloadPart, "base64")),
      decipher.final()
    ]).toString("utf8");

    const parsed: unknown = JSON.parse(plain);

    return isStringRecord(parsed) ? parsed : {};
  } catch (error) {
    if (error instanceof CourierCredentialsError) {
      throw error;
    }

    // A GCM tag mismatch means the key changed or the row was tampered with.
    throw new CourierCredentialsError(
      "Could not decrypt the stored courier credentials. COURIER_CREDENTIALS_KEY may have changed — re-enter the keys in courier settings."
    );
  }
}

/** Last four characters, so settings can prove which secret is stored. */
export function secretHintFor(value: string | undefined) {
  const trimmed = value?.trim() ?? "";

  return trimmed.length >= 4 ? `••••${trimmed.slice(-4)}` : null;
}

/** Constant-time compare, for the webhook bearer token in Phase 6. */
export function safeEquals(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

function readKey() {
  const raw = process.env.COURIER_CREDENTIALS_KEY?.trim();

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
