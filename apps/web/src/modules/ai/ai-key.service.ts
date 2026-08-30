import { decryptSecret, encryptSecret, isSecretEncryptionConfigured } from "../../lib/secret-box";
import { createAiApiKey } from "./ai-key-token";
import {
  createApiKeyRecord,
  deleteApiKeyForStore,
  getApiKeySecretForStore,
  getApiKeysForStore,
  revokeApiKeyForStore
} from "./ai-key.repository";
import {
  apiKeySummarySchema,
  issueApiKeyInputSchema,
  parseStoredScopes,
  type ApiKeySummary,
  type IssueApiKeyInput
} from "./ai.schema";

/**
 * The lifecycle of an AI API key: issue, list, reveal, revoke, delete.
 *
 * A key is stored twice, for two different questions. `tokenHash` is a SHA-256
 * and is what authentication compares against — a leaked database still cannot
 * be replayed by hashing. `secretCipher` is an AES-256-GCM sealing of the same
 * value through `lib/secret-box.ts`, and exists so the seller who owns the key
 * can read it back. The trade is deliberate and worth naming: a copy that can be
 * decrypted is a copy that an attacker holding both the database and
 * `COURIER_CREDENTIALS_KEY` can decrypt too. It buys the thing sellers actually
 * need — a key they can look up in settings when they are wiring up StoreOS AI
 * on a second machine, rather than a key they must re-issue and re-paste
 * everywhere every time they lose the tab.
 *
 * Where no encryption key is configured, issuing still works and the cipher is
 * simply not written. Such a key authenticates exactly as before and reports
 * `canReveal: false`.
 *
 * Every function takes `storeId` first, like every other service here, and the
 * repository re-scopes each read and write to it. Nothing in this file resolves
 * a tenant of its own.
 */

export class AiApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiApiKeyError";
  }
}

export type IssuedApiKey = {
  /**
   * The raw key, handed straight to the person who asked for it. Also recoverable
   * afterwards through `revealStoreApiKey`, unless the deployment has no
   * encryption key set.
   */
  key: string;
  record: ApiKeySummary;
};

export async function issueStoreApiKey(
  storeId: string,
  input: IssueApiKeyInput
): Promise<IssuedApiKey> {
  const data = issueApiKeyInputSchema.parse(input);
  const generated = createAiApiKey();
  const record = await createApiKeyRecord({
    hint: generated.hint,
    name: data.name,
    scopes: data.scopes,
    // Guarded rather than caught: a missing encryption key is a deployment
    // that never intended to store readable secrets, not an error to fail a
    // key issuance over.
    secretCipher: isSecretEncryptionConfigured() ? encryptSecret(generated.key) : null,
    storeId,
    tokenHash: generated.tokenHash,
    ...(data.expiresAt ? { expiresAt: data.expiresAt } : {})
  });

  return {
    key: generated.key,
    record: toSummary(record)
  };
}

export async function listStoreApiKeys(storeId: string): Promise<ApiKeySummary[]> {
  const records = await getApiKeysForStore(storeId);

  return records.map(toSummary);
}

export type RevealedApiKey = {
  id: string;
  key: string;
  name: string;
};

/**
 * Reads a stored key back.
 *
 * Returns null for every reason a key might not be readable — wrong store,
 * deleted, issued before the store kept a copy, no encryption key configured —
 * and the caller cannot tell them apart, which is what stops this being a probe
 * for another store's key ids.
 *
 * A decrypt that fails on the tag is treated the same way. That means the
 * encryption key changed under a row that was sealed with the old one; the key
 * itself still works, so the honest answer is "cannot show it", not an error
 * page.
 */
export async function revealStoreApiKey(
  storeId: string,
  apiKeyId: string
): Promise<RevealedApiKey | null> {
  const record = await getApiKeySecretForStore(storeId, apiKeyId);

  if (!record?.secretCipher || !isSecretEncryptionConfigured()) {
    return null;
  }

  try {
    const key = decryptSecret(record.secretCipher);

    return key ? { id: record.id, key, name: record.name } : null;
  } catch {
    return null;
  }
}

/**
 * Revocation is immediate: the next request carrying this key fails at
 * `resolveApiKeyStore` because `revokedAt` is read on every authentication
 * rather than cached anywhere.
 *
 * Returns null when the key does not belong to this store or was already
 * revoked — the caller cannot tell those apart, which is what stops one store
 * probing another's key ids.
 */
export async function revokeStoreApiKey(
  storeId: string,
  apiKeyId: string
): Promise<ApiKeySummary | null> {
  const record = await revokeApiKeyForStore(storeId, apiKeyId);

  return record ? toSummary(record) : null;
}

/**
 * Removes a key entirely, rather than leaving a revoked row behind.
 *
 * Deleting stops the credential working for the same reason revoking does —
 * authentication looks the hash up on every request and now finds nothing — so
 * this is not a weaker action than revoke, it is the same one without the
 * tombstone. The tombstone is worth keeping when a key may have been used
 * improperly and the seller wants the record; it is only clutter once they have
 * decided the key was a mistake. Which of those is true is theirs to say, so
 * both are offered.
 */
export async function deleteStoreApiKey(
  storeId: string,
  apiKeyId: string
): Promise<ApiKeySummary | null> {
  const record = await deleteApiKeyForStore(storeId, apiKeyId);

  return record ? toSummary(record) : null;
}

type ApiKeyRecord = Awaited<ReturnType<typeof getApiKeysForStore>>[number];

/**
 * Stored scopes are filtered back through the vocabulary before they are shown.
 * A scope that has since been removed from the code is dropped rather than
 * echoed, so what a seller reads is what would actually be honoured.
 */
function toSummary(record: ApiKeyRecord): ApiKeySummary {
  return apiKeySummarySchema.parse({
    canReveal: record.canReveal,
    createdAt: record.createdAt,
    expiresAt: record.expiresAt,
    hint: record.hint,
    id: record.id,
    lastUsedAt: record.lastUsedAt,
    name: record.name,
    revokedAt: record.revokedAt,
    scopes: parseStoredScopes(record.scopes)
  });
}
