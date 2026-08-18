import { prisma } from "@dash/db";
import {
  createSynonymGroup,
  deleteSearchBoost,
  deleteSearchRedirect,
  deleteSynonymGroup,
  getSearchAnalytics,
  listSearchBoosts,
  listSearchRedirects,
  listSynonymGroups,
  upsertSearchBoost,
  upsertSearchRedirect
} from "./search-admin.repository";
import { searchBoostSchema, searchRedirectSchema, synonymGroupSchema } from "./search-admin.schema";

const ANALYTICS_LIMIT = 10;

export async function getSearchDiscoveryOverview(storeId: string) {
  const [synonymGroups, boosts, redirects, analytics] = await Promise.all([
    listSynonymGroups(storeId),
    listSearchBoosts(storeId),
    listSearchRedirects(storeId),
    getSearchAnalytics(storeId, ANALYTICS_LIMIT)
  ]);

  return { analytics, boosts, redirects, synonymGroups };
}

export async function addSynonymGroup(storeId: string, input: unknown) {
  const { terms } = synonymGroupSchema.parse(input);

  return createSynonymGroup(storeId, terms);
}

export async function removeSynonymGroup(storeId: string, id: string) {
  await deleteSynonymGroup(storeId, id);
}

export async function addSearchBoost(storeId: string, input: unknown) {
  const { productId, query } = searchBoostSchema.parse(input);

  // A pin names a product by id from a form, so ownership is checked here
  // rather than trusted: without this a crafted request could pin another
  // store's product into these results.
  const product = await prisma.product.findFirst({
    where: { id: productId, storeId },
    select: { id: true }
  });

  if (!product) {
    throw new Error("That product does not belong to this store.");
  }

  const existing = await prisma.searchBoost.count({ where: { query, storeId } });

  return upsertSearchBoost(storeId, query, productId, existing);
}

export async function removeSearchBoost(storeId: string, id: string) {
  await deleteSearchBoost(storeId, id);
}

export async function addSearchRedirect(storeId: string, input: unknown) {
  const { query, targetUrl } = searchRedirectSchema.parse(input);

  return upsertSearchRedirect(storeId, query, targetUrl);
}

export async function removeSearchRedirect(storeId: string, id: string) {
  await deleteSearchRedirect(storeId, id);
}
