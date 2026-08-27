import { createAiApiKey } from "./ai-key-token";
import { createApiKeyRecord, getApiKeysForStore, revokeApiKeyForStore } from "./ai-key.repository";
import {
  apiKeySummarySchema,
  issueApiKeyInputSchema,
  parseStoredScopes,
  type ApiKeySummary,
  type IssueApiKeyInput
} from "./ai.schema";

/**
 * The lifecycle of an AI API key: issue, list, revoke.
 *
 * There is no "show me the key again" and there never will be — the raw value
 * exists in memory for the length of `issueStoreApiKey` and in the response of
 * the one call that created it. A seller who loses it revokes and issues
 * another, which is cheap; the alternative is a table full of replayable
 * credentials, which is not.
 *
 * Every function takes `storeId` first, like every other service here, and the
 * repository re-scopes each write to it. Nothing in this file resolves a tenant
 * of its own.
 */

export class AiApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiApiKeyError";
  }
}

export type IssuedApiKey = {
  /**
   * The raw key. Returned exactly once, by this call, and never stored, logged,
   * or recoverable afterwards. Hand it straight to the person who asked for it.
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

type ApiKeyRecord = Awaited<ReturnType<typeof getApiKeysForStore>>[number];

/**
 * Stored scopes are filtered back through the vocabulary before they are shown.
 * A scope that has since been removed from the code is dropped rather than
 * echoed, so what a seller reads is what would actually be honoured.
 */
function toSummary(record: ApiKeyRecord): ApiKeySummary {
  return apiKeySummarySchema.parse({
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
