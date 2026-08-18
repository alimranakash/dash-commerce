import { prisma } from "@dash/db";

export async function listSynonymGroups(storeId: string) {
  return prisma.searchSynonym.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" }
  });
}

export async function createSynonymGroup(storeId: string, terms: string[]) {
  return prisma.searchSynonym.create({
    data: { storeId, terms }
  });
}

export async function deleteSynonymGroup(storeId: string, id: string) {
  // Scoped by storeId as well as id so one store can never delete another's rule.
  await prisma.searchSynonym.deleteMany({
    where: { id, storeId }
  });
}

export async function listSearchBoosts(storeId: string) {
  return prisma.searchBoost.findMany({
    where: { storeId },
    include: {
      product: {
        select: { slug: true, title: true }
      }
    },
    orderBy: [{ query: "asc" }, { position: "asc" }]
  });
}

export async function upsertSearchBoost(
  storeId: string,
  query: string,
  productId: string,
  position: number
) {
  return prisma.searchBoost.upsert({
    where: {
      storeId_query_productId: { productId, query, storeId }
    },
    create: { position, productId, query, storeId },
    update: { position }
  });
}

export async function deleteSearchBoost(storeId: string, id: string) {
  await prisma.searchBoost.deleteMany({
    where: { id, storeId }
  });
}

export async function listSearchRedirects(storeId: string) {
  return prisma.searchRedirect.findMany({
    where: { storeId },
    orderBy: { query: "asc" }
  });
}

export async function upsertSearchRedirect(storeId: string, query: string, targetUrl: string) {
  return prisma.searchRedirect.upsert({
    where: {
      storeId_query: { query, storeId }
    },
    create: { query, storeId, targetUrl },
    update: { targetUrl }
  });
}

export async function deleteSearchRedirect(storeId: string, id: string) {
  await prisma.searchRedirect.deleteMany({
    where: { id, storeId }
  });
}

/**
 * Top searches and the ones that came back empty, in one pass each.
 *
 * Zero-result rows are the actionable half: every one is a shopper who wanted
 * something and was told the store has nothing, which a synonym or a redirect
 * can usually fix.
 */
export async function getSearchAnalytics(storeId: string, limit: number) {
  const [topQueries, zeroResultQueries] = await Promise.all([
    prisma.searchQueryStat.findMany({
      where: { storeId },
      orderBy: [{ searchCount: "desc" }, { lastSearchedAt: "desc" }],
      take: limit
    }),
    prisma.searchQueryStat.findMany({
      where: { storeId, lastResultCount: 0 },
      orderBy: [{ searchCount: "desc" }, { lastSearchedAt: "desc" }],
      take: limit
    })
  ]);

  return { topQueries, zeroResultQueries };
}

export async function recordSearchQuery(storeId: string, query: string, resultCount: number) {
  const now = new Date();

  await prisma.searchQueryStat.upsert({
    where: {
      storeId_query: { query, storeId }
    },
    create: {
      lastResultCount: resultCount,
      lastSearchedAt: now,
      query,
      searchCount: 1,
      storeId
    },
    update: {
      lastResultCount: resultCount,
      lastSearchedAt: now,
      searchCount: { increment: 1 }
    }
  });
}

export async function findStoreProductsForBoosting(storeId: string) {
  return prisma.product.findMany({
    where: { storeId, status: "ACTIVE", visibility: "PUBLIC" },
    select: { id: true, title: true },
    orderBy: { title: "asc" },
    take: 300
  });
}
