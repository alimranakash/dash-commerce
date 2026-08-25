import { prisma } from "@dash/db";
import { compileAudienceRules } from "./audience.compiler";
import {
  audienceNameExistsForStore,
  cacheAudienceCount,
  createAudienceRecord,
  deleteAudienceRecord,
  getAudienceByIdForStore,
  getAudiencesForStore,
  updateAudienceRecord
} from "./audience.repository";
import {
  ALL_CUSTOMERS_RULES,
  audienceRulesSchema,
  audienceSchema,
  describeAudienceRules,
  type AudienceInput,
  type AudienceRules
} from "./audience.schema";
import { CampaignError } from "./campaign.service";

export { getAudienceByIdForStore, getAudiencesForStore };

export type AudienceView = {
  cachedCount: number | null;
  /** How many campaigns point at this segment — what makes deleting it risky. */
  campaignCount: number;
  countedAt: Date | null;
  createdAt: Date;
  description: string | null;
  id: string;
  name: string;
  rules: AudienceRules;
  summary: string;
};

type AudienceRow = Awaited<ReturnType<typeof getAudienceByIdForStore>>;

export function toAudienceView(audience: NonNullable<AudienceRow>): AudienceView {
  const rules = parseStoredRules(audience.rules);

  return {
    cachedCount: audience.cachedCount,
    campaignCount: audience._count.campaigns,
    countedAt: audience.countedAt,
    createdAt: audience.createdAt,
    description: audience.description,
    id: audience.id,
    name: audience.name,
    rules,
    summary: describeAudienceRules(rules)
  };
}

/**
 * Reads rules back out of stored JSON.
 *
 * Anything that no longer parses returns an empty rule set rather than "all
 * customers". A segment whose stored shape has moved on should reach nobody
 * until someone re-saves it — silently widening to everyone is the one failure
 * mode here that costs money.
 */
export function parseStoredRules(value: unknown): AudienceRules {
  if (value === null || value === undefined) {
    return ALL_CUSTOMERS_RULES;
  }

  const parsed = audienceRulesSchema.safeParse(value);

  return parsed.success ? parsed.data : [];
}

export async function listAudiences(storeId: string, search?: string) {
  const audiences = await getAudiencesForStore(storeId, search);

  return audiences.map(toAudienceView);
}

export async function findAudience(storeId: string, audienceId: string) {
  const audience = await getAudienceByIdForStore(storeId, audienceId);

  return audience ? toAudienceView(audience) : null;
}

export async function createAudience(storeId: string, input: AudienceInput) {
  const data = audienceSchema.parse(input);

  if (await audienceNameExistsForStore(storeId, data.name)) {
    throw new CampaignError(`An audience called ${data.name} already exists.`, "name");
  }

  return createAudienceRecord({
    description: data.description ?? null,
    name: data.name,
    rules: data.rules,
    storeId
  });
}

export async function updateAudience(storeId: string, audienceId: string, input: AudienceInput) {
  const data = audienceSchema.parse(input);
  const existing = await getAudienceByIdForStore(storeId, audienceId);

  if (!existing) {
    return null;
  }

  if (await audienceNameExistsForStore(storeId, data.name, audienceId)) {
    throw new CampaignError(`An audience called ${data.name} already exists.`, "name");
  }

  return updateAudienceRecord(storeId, audienceId, {
    // Cleared because the rules changed: a size computed against the old
    // definition would be a wrong number presented as a current one.
    cachedCount: null,
    countedAt: null,
    description: data.description ?? null,
    name: data.name,
    rules: data.rules
  });
}

/**
 * Removes a saved segment.
 *
 * Refused while campaigns still reference it. `onDelete: SetNull` would let the
 * delete through and quietly detach those campaigns — a draft would fall back to
 * reaching everyone, which is the most expensive possible interpretation of a
 * segment that no longer exists.
 */
export async function deleteAudience(storeId: string, audienceId: string) {
  const existing = await getAudienceByIdForStore(storeId, audienceId);

  if (!existing) {
    return null;
  }

  if (existing._count.campaigns > 0) {
    const count = existing._count.campaigns;

    throw new CampaignError(
      `${existing.name} is used by ${count} ${count === 1 ? "campaign" : "campaigns"} and cannot be deleted.`
    );
  }

  await deleteAudienceRecord(storeId, audienceId);

  return existing;
}

/** Recomputes a saved segment's size and remembers it for the list screen. */
export async function refreshAudienceCount(storeId: string, audienceId: string) {
  const audience = await getAudienceByIdForStore(storeId, audienceId);

  if (!audience) {
    return null;
  }

  const where = await compileAudienceRules(storeId, parseStoredRules(audience.rules));
  const count = await prisma.customer.count({ where });

  await cacheAudienceCount(audienceId, count);

  return count;
}
