import {
  SecretBoxError,
  decryptSecretRecord,
  encryptSecretRecord,
  isSecretEncryptionConfigured,
  requireSecretEncryptionKey,
  safeEquals,
  secretHintFor
} from "../../lib/secret-box";

/**
 * Courier-facing view of the shared secret box (`lib/secret-box.ts`).
 *
 * The crypto itself moved there so the Meta Conversions API token can reuse it;
 * this module keeps the courier wording on errors and the same exported API, so
 * nothing in the courier stack had to change. Non-secret values (base URL, a
 * carrier's own store id) still live in `CourierAccount.credentialsPublic`, so
 * settings can show them back without a decrypt.
 */

export class CourierCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourierCredentialsError";
  }
}

export function isCourierEncryptionConfigured() {
  return isSecretEncryptionConfigured();
}

export function requireCourierEncryptionKey() {
  return asCourierError(() => requireSecretEncryptionKey());
}

export function encryptCredentials(values: Record<string, string>) {
  return asCourierError(() => encryptSecretRecord(values));
}

export function decryptCredentials(value: string | null | undefined): Record<string, string> {
  return asCourierError(() => decryptSecretRecord(value));
}

export { safeEquals, secretHintFor };

function asCourierError<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof SecretBoxError) {
      throw new CourierCredentialsError(courierMessageFor(error.message));
    }

    throw error;
  }
}

function courierMessageFor(message: string) {
  if (message.includes("missing or invalid")) {
    return "COURIER_CREDENTIALS_KEY is missing or invalid. Generate a 32-byte base64 key and add it to the root .env before saving courier credentials.";
  }

  if (message.includes("unrecognised format")) {
    return "Stored courier credentials are in an unrecognised format.";
  }

  return "Could not decrypt the stored courier credentials. COURIER_CREDENTIALS_KEY may have changed — re-enter the keys in courier settings.";
}
