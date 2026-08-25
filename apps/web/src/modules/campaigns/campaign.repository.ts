import { prisma } from "@dash/db";
import type { Prisma } from "@dash/db";

export type CampaignFilters = {
  search?: string | undefined;
  status?: Prisma.EnumCampaignStatusFilter["equals"] | undefined;
};

function campaignWhere(storeId: string, filters: CampaignFilters = {}): Prisma.CampaignWhereInput {
  const search = filters.search?.trim();

  return {
    storeId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { body: { contains: search, mode: "insensitive" } }
          ]
        }
      : {})
  };
}

export async function getCampaignsForStore(storeId: string, filters: CampaignFilters = {}) {
  return prisma.campaign.findMany({
    where: campaignWhere(storeId, filters),
    include: {
      audience: {
        select: { name: true }
      },
      coupon: {
        select: { code: true }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getCampaignByIdForStore(storeId: string, campaignId: string) {
  return prisma.campaign.findFirst({
    where: {
      id: campaignId,
      storeId
    },
    include: {
      audience: {
        select: { name: true, rules: true }
      },
      coupon: {
        select: { code: true }
      }
    }
  });
}

export async function getCampaignCountsForStore(storeId: string) {
  const grouped = await prisma.campaign.groupBy({
    by: ["status"],
    where: { storeId },
    _count: { _all: true }
  });

  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));

  return {
    all: grouped.reduce((total, row) => total + row._count._all, 0),
    draft: counts.DRAFT ?? 0,
    sending: (counts.SENDING ?? 0) + (counts.SCHEDULED ?? 0),
    sent: counts.SENT ?? 0
  };
}

export async function createCampaignRecord(data: Prisma.CampaignUncheckedCreateInput) {
  return prisma.campaign.create({ data });
}

export async function updateCampaignRecord(
  storeId: string,
  campaignId: string,
  data: Prisma.CampaignUncheckedUpdateInput
) {
  // Store-scoped in the same statement that writes, so ownership cannot change
  // between the check and the update.
  const result = await prisma.campaign.updateMany({
    where: { id: campaignId, storeId },
    data
  });

  if (result.count === 0) {
    return null;
  }

  return getCampaignByIdForStore(storeId, campaignId);
}

export async function deleteCampaignRecord(storeId: string, campaignId: string) {
  return prisma.campaign.deleteMany({
    where: { id: campaignId, storeId }
  });
}

/* -------------------------------------------------------------------------- */
/*                              Recipient ledger                              */
/* -------------------------------------------------------------------------- */

export type CampaignRecipientSeed = {
  customerId: string;
  name: string;
  recipient: string;
};

/**
 * Writes the recipient rows for a campaign, in chunks.
 *
 * `skipDuplicates` leans on `@@unique([campaignId, recipient])`, which is what
 * makes this safe to run twice: a retried or resumed materialisation adds the
 * rows that are missing and silently leaves the ones already there alone,
 * rather than queueing a second message to everyone who was reached first time.
 *
 * Chunked because a store with tens of thousands of customers would otherwise
 * build one insert statement large enough to matter.
 */
export async function insertCampaignRecipients(
  campaignId: string,
  seeds: CampaignRecipientSeed[],
  chunkSize = 1000
) {
  let inserted = 0;

  for (let index = 0; index < seeds.length; index += chunkSize) {
    const chunk = seeds.slice(index, index + chunkSize);
    const result = await prisma.campaignRecipient.createMany({
      data: chunk.map((seed) => ({
        campaignId,
        customerId: seed.customerId,
        name: seed.name,
        recipient: seed.recipient
      })),
      skipDuplicates: true
    });

    inserted += result.count;
  }

  return inserted;
}

export async function getCampaignRecipientCounts(campaignId: string) {
  const grouped = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true }
  });

  const counts = Object.fromEntries(grouped.map((row) => [row.status, row._count._all]));

  return {
    blocked: counts.BLOCKED ?? 0,
    failed: counts.FAILED ?? 0,
    pending: counts.PENDING ?? 0,
    sending: counts.SENDING ?? 0,
    sent: counts.SENT ?? 0,
    skipped: counts.SKIPPED ?? 0,
    total: grouped.reduce((total, row) => total + row._count._all, 0)
  };
}

export async function getCampaignRecipients(
  campaignId: string,
  options: { skip?: number; take?: number } = {}
) {
  return prisma.campaignRecipient.findMany({
    where: { campaignId },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    skip: options.skip ?? 0,
    take: options.take ?? 100
  });
}

export async function deleteCampaignRecipients(campaignId: string) {
  return prisma.campaignRecipient.deleteMany({
    where: { campaignId }
  });
}
