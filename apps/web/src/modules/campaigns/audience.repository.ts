import { prisma } from "@dash/db";
import type { Prisma } from "@dash/db";

export async function getAudiencesForStore(storeId: string, search?: string) {
  const query = search?.trim();

  return prisma.campaignAudience.findMany({
    where: {
      storeId,
      ...(query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { description: { contains: query, mode: "insensitive" } }
            ]
          }
        : {})
    },
    include: {
      _count: {
        select: { campaigns: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });
}

export async function getAudienceByIdForStore(storeId: string, audienceId: string) {
  return prisma.campaignAudience.findFirst({
    where: { id: audienceId, storeId },
    include: {
      _count: {
        select: { campaigns: true }
      }
    }
  });
}

export async function audienceNameExistsForStore(
  storeId: string,
  name: string,
  excludeAudienceId?: string
) {
  const existing = await prisma.campaignAudience.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      storeId,
      ...(excludeAudienceId ? { id: { not: excludeAudienceId } } : {})
    },
    select: { id: true }
  });

  return existing !== null;
}

export async function createAudienceRecord(data: Prisma.CampaignAudienceUncheckedCreateInput) {
  return prisma.campaignAudience.create({ data });
}

export async function updateAudienceRecord(
  storeId: string,
  audienceId: string,
  data: Prisma.CampaignAudienceUncheckedUpdateInput
) {
  const result = await prisma.campaignAudience.updateMany({
    where: { id: audienceId, storeId },
    data
  });

  if (result.count === 0) {
    return null;
  }

  return getAudienceByIdForStore(storeId, audienceId);
}

export async function deleteAudienceRecord(storeId: string, audienceId: string) {
  return prisma.campaignAudience.deleteMany({
    where: { id: audienceId, storeId }
  });
}

/**
 * Stores the last computed size for the list screen.
 *
 * Never read by anything that decides who gets a message — that always
 * recompiles the rules. This is a number to look at, not a number to act on.
 */
export async function cacheAudienceCount(audienceId: string, count: number) {
  await prisma.campaignAudience.updateMany({
    where: { id: audienceId },
    data: { cachedCount: count, countedAt: new Date() }
  });
}
