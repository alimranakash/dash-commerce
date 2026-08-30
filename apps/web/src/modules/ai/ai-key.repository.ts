import { prisma } from "@dash/db";
import { ensureApiKeySecretSchema } from "./ai-key-secret-schema";

/**
 * The only file in `modules/ai/` that is allowed to touch Prisma.
 *
 * Everything else in the AI module reads commerce data through the existing
 * store-scoped services, which is what keeps the tenant guarantees the rest of
 * the codebase already enforces from having to be re-implemented — badly — for
 * one external consumer. What is left here is credential storage, which no other
 * module owns.
 *
 * Two columns never leave this file in raw form. `tokenHash` leaves the database
 * on exactly one path: the authentication lookup below, which already knows it.
 * `secretCipher` leaves on exactly one path too — `getApiKeySecretForStore`,
 * which the settings reveal action calls after re-checking that the caller
 * manages the store. Everywhere else it is collapsed to the boolean `canReveal`
 * before the row is handed out, so a listing cannot leak it by being widened.
 */

type CreateApiKeyRecordInput = {
  expiresAt?: Date | undefined;
  hint: string;
  name: string;
  scopes: string[];
  /** Null when the deployment has no encryption key — the key is then unreadable. */
  secretCipher: string | null;
  storeId: string;
  tokenHash: string;
};

/** What settings and the key service are allowed to see. Note the absent hash. */
const apiKeySummarySelect = {
  createdAt: true,
  expiresAt: true,
  hint: true,
  id: true,
  lastUsedAt: true,
  name: true,
  revokedAt: true,
  scopes: true,
  secretCipher: true
} as const;

type ApiKeySummaryRow = {
  createdAt: Date;
  expiresAt: Date | null;
  hint: string;
  id: string;
  lastUsedAt: Date | null;
  name: string;
  revokedAt: Date | null;
  scopes: string[];
  secretCipher: string | null;
};

/**
 * Swaps the ciphertext for the one bit of it callers are allowed to know: is
 * there something here that could be shown. The string itself stops at this
 * line.
 */
function toSummaryRecord({ secretCipher, ...rest }: ApiKeySummaryRow) {
  return { ...rest, canReveal: secretCipher !== null };
}

export type ApiKeySummaryRecord = ReturnType<typeof toSummaryRecord>;

/**
 * The authentication lookup — one indexed equality query on a unique column.
 *
 * The store is joined in rather than fetched separately because the question
 * being answered is "which live tenant does this credential belong to", and
 * splitting it into two queries would only widen the window in which a store
 * could be suspended between the two. The select is limited to the two fields
 * that decision needs: no name, no settings, no commerce data. Anything the
 * caller is later allowed to *read* about the store goes through
 * `ai-context.service.ts` and the stores repository, not through here.
 *
 * `secretCipher` is deliberately absent, which is also why this path needs no
 * `ensureApiKeySecretSchema()`: the API authenticates on a database that has
 * never been pushed to.
 */
export async function findApiKeyByTokenHash(tokenHash: string) {
  return prisma.storeApiKey.findUnique({
    where: {
      tokenHash
    },
    select: {
      expiresAt: true,
      hint: true,
      id: true,
      // Read so authentication can decide whether the last-used marker is stale
      // enough to be worth a write — see `touchLastUsed` in ai-auth.ts.
      lastUsedAt: true,
      name: true,
      revokedAt: true,
      scopes: true,
      storeId: true,
      tokenHash: true,
      store: {
        select: {
          id: true,
          status: true
        }
      }
    }
  });
}

/**
 * Best-effort last-seen marker.
 *
 * `updateMany` rather than `update` so a key revoked and deleted in the moment
 * between authenticating and returning does not throw a "record not found" into
 * the middle of a request that has already been authorised. Nothing reads this
 * field to make a decision, so losing a write costs nothing.
 */
export async function touchApiKeyLastUsed(apiKeyId: string, at = new Date()) {
  return prisma.storeApiKey.updateMany({
    where: {
      id: apiKeyId
    },
    data: {
      lastUsedAt: at
    }
  });
}

export async function createApiKeyRecord(input: CreateApiKeyRecordInput) {
  await ensureApiKeySecretSchema();

  const record = await prisma.storeApiKey.create({
    data: {
      hint: input.hint,
      name: input.name,
      scopes: input.scopes,
      secretCipher: input.secretCipher,
      storeId: input.storeId,
      tokenHash: input.tokenHash,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
    },
    select: apiKeySummarySelect
  });

  return toSummaryRecord(record);
}

export async function getApiKeysForStore(storeId: string) {
  await ensureApiKeySecretSchema();

  const records = await prisma.storeApiKey.findMany({
    where: {
      storeId
    },
    select: apiKeySummarySelect,
    orderBy: {
      createdAt: "desc"
    }
  });

  return records.map(toSummaryRecord);
}

/**
 * The one path the stored ciphertext takes out of this file.
 *
 * Store-scoped in the `where`, like every read here, so an id belonging to
 * another store returns null rather than that store's credential. The caller
 * decrypts; nothing is cached.
 */
export async function getApiKeySecretForStore(storeId: string, apiKeyId: string) {
  await ensureApiKeySecretSchema();

  return prisma.storeApiKey.findFirst({
    where: {
      id: apiKeyId,
      storeId
    },
    select: {
      id: true,
      name: true,
      secretCipher: true
    }
  });
}

/**
 * Store-scoped in the same statement that writes, the way every other
 * repository in this codebase does it, so one store can never revoke another's
 * key by guessing an id.
 */
export async function revokeApiKeyForStore(storeId: string, apiKeyId: string, at = new Date()) {
  await ensureApiKeySecretSchema();

  const result = await prisma.storeApiKey.updateMany({
    where: {
      id: apiKeyId,
      revokedAt: null,
      storeId
    },
    data: {
      revokedAt: at
    }
  });

  if (result.count === 0) {
    return null;
  }

  const record = await prisma.storeApiKey.findFirst({
    where: {
      id: apiKeyId,
      storeId
    },
    select: apiKeySummarySelect
  });

  return record ? toSummaryRecord(record) : null;
}

/**
 * Removes the row outright, ciphertext and hash with it.
 *
 * Read first, then delete, because the caller needs the name for the message it
 * shows and there is nothing left to read afterwards. Both statements are scoped
 * to the store, so the read cannot confirm another tenant's id and the delete
 * cannot act on one — a lost race between the two ends as `count === 0`, which
 * is reported the same way as "never existed".
 */
export async function deleteApiKeyForStore(storeId: string, apiKeyId: string) {
  await ensureApiKeySecretSchema();

  const record = await prisma.storeApiKey.findFirst({
    where: {
      id: apiKeyId,
      storeId
    },
    select: apiKeySummarySelect
  });

  if (!record) {
    return null;
  }

  const result = await prisma.storeApiKey.deleteMany({
    where: {
      id: apiKeyId,
      storeId
    }
  });

  return result.count === 0 ? null : toSummaryRecord(record);
}
