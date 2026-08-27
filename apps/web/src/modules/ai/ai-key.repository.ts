import { prisma } from "@dash/db";

/**
 * The only file in `modules/ai/` that is allowed to touch Prisma.
 *
 * Everything else in the AI module reads commerce data through the existing
 * store-scoped services, which is what keeps the tenant guarantees the rest of
 * the codebase already enforces from having to be re-implemented — badly — for
 * one external consumer. What is left here is credential storage, which no other
 * module owns.
 *
 * `tokenHash` is never selected by anything that lists or displays keys. It
 * leaves the database on exactly one path: the authentication lookup below,
 * which already knows it.
 */

type CreateApiKeyRecordInput = {
  expiresAt?: Date | undefined;
  hint: string;
  name: string;
  scopes: string[];
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
  scopes: true
} as const;

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
  return prisma.storeApiKey.create({
    data: {
      hint: input.hint,
      name: input.name,
      scopes: input.scopes,
      storeId: input.storeId,
      tokenHash: input.tokenHash,
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {})
    },
    select: apiKeySummarySelect
  });
}

export async function getApiKeysForStore(storeId: string) {
  return prisma.storeApiKey.findMany({
    where: {
      storeId
    },
    select: apiKeySummarySelect,
    orderBy: {
      createdAt: "desc"
    }
  });
}

/**
 * Store-scoped in the same statement that writes, the way every other
 * repository in this codebase does it, so one store can never revoke another's
 * key by guessing an id.
 */
export async function revokeApiKeyForStore(storeId: string, apiKeyId: string, at = new Date()) {
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

  return prisma.storeApiKey.findFirst({
    where: {
      id: apiKeyId,
      storeId
    },
    select: apiKeySummarySelect
  });
}
