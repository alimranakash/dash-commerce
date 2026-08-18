import { prisma } from "@dash/db";
import { ensureSearchSchema, getDatabaseSchemaName } from "./search-schema";

export type RankedProductMatch = {
  productId: string;
  rank: number;
};

/**
 * Below this the query and the product title share so little that a match is
 * more likely to confuse than to help. Chosen against real catalogue data:
 * genuine typos land at 0.5-0.7 ("speker"/"Speaker" is 0.50) while unrelated
 * titles sit near 0.2.
 */
const FUZZY_MATCH_THRESHOLD = 0.45;

/**
 * Products matching a `tsquery`, best first.
 *
 * The score blends four signals, mirroring what a shopper means by "relevant":
 * how well the weighted document matches, whether the title is the query,
 * whether the title starts with it, and whether the product is actually
 * buyable. Category names are joined in rather than baked into `searchVector`
 * so renaming a category takes effect immediately.
 */
export async function findProductsByTextQuery(
  storeId: string,
  rawQuery: string,
  tsQuery: string,
  limit: number
) {
  await ensureSearchSchema();
  const schema = getDatabaseSchemaName();

  return prisma.$queryRawUnsafe<RankedProductMatch[]>(
    `
    WITH search_query AS (
      SELECT
        $2::text AS raw,
        to_tsquery('simple', $3::text) AS simple_query,
        to_tsquery('english', $3::text) AS english_query
    )
    SELECT
      product."id" AS "productId",
      (
        ts_rank_cd(
          product."searchVector",
          search_query.simple_query || search_query.english_query
        ) * 4
        + CASE WHEN lower(product."title") = lower(search_query.raw) THEN 3 ELSE 0 END
        + CASE WHEN product."title" ILIKE search_query.raw || '%' THEN 1.5 ELSE 0 END
        + CASE WHEN category."name" ILIKE '%' || search_query.raw || '%' THEN 0.6 ELSE 0 END
        + CASE WHEN product."stockQuantity" > 0 THEN 0.3 ELSE 0 END
      )::float8 AS rank
    FROM "${schema}"."Product" product
    LEFT JOIN "${schema}"."Category" category ON category."id" = product."categoryId"
    CROSS JOIN search_query
    WHERE product."storeId" = $1
      AND product."status" = 'ACTIVE'
      AND product."visibility" = 'PUBLIC'
      AND (
        product."searchVector" @@ (search_query.simple_query || search_query.english_query)
        OR category."name" ILIKE '%' || search_query.raw || '%'
      )
    ORDER BY rank DESC, product."updatedAt" DESC
    LIMIT $4
  `,
    storeId,
    rawQuery,
    tsQuery,
    limit
  );
}

/**
 * Typo rescue. Only worth running once full-text search has come up short,
 * because it compares the query against every title in the store rather than
 * probing an index.
 *
 * `word_similarity` scores the query against the closest *word* in the title,
 * which is why "hedphones" reaches "Nova Wireless Headphones"; plain
 * `similarity` dilutes that across the whole string and misses it.
 */
export async function findProductsByFuzzyTitle(storeId: string, rawQuery: string, limit: number) {
  const { trigramEnabled } = await ensureSearchSchema();

  if (!trigramEnabled) {
    return [];
  }

  const schema = getDatabaseSchemaName();

  return prisma.$queryRawUnsafe<RankedProductMatch[]>(
    `
    SELECT
      product."id" AS "productId",
      (
        word_similarity($2::text, product."title") * 4
        + CASE WHEN product."stockQuantity" > 0 THEN 0.3 ELSE 0 END
      )::float8 AS rank
    FROM "${schema}"."Product" product
    WHERE product."storeId" = $1
      AND product."status" = 'ACTIVE'
      AND product."visibility" = 'PUBLIC'
      AND word_similarity($2::text, product."title") >= ${FUZZY_MATCH_THRESHOLD}
    ORDER BY rank DESC, product."updatedAt" DESC
    LIMIT $3
  `,
    storeId,
    rawQuery,
    limit
  );
}

/**
 * Minimal store lookup for the suggest endpoint. The full storefront resolver
 * loads settings, theme and domains, none of which a suggestion list needs and
 * all of which would be paid for on every keystroke.
 */
export async function findSearchableStoreBySlug(slug: string) {
  return prisma.store.findFirst({
    where: {
      slug,
      status: {
        in: ["ACTIVE", "DRAFT"]
      }
    },
    select: {
      currency: true,
      id: true,
      slug: true
    }
  });
}

export async function findSuggestedCategories(storeId: string, rawQuery: string, limit: number) {
  return prisma.category.findMany({
    where: {
      storeId,
      name: {
        contains: rawQuery,
        mode: "insensitive"
      },
      products: {
        some: {
          status: "ACTIVE",
          storeId,
          visibility: "PUBLIC"
        }
      }
    },
    select: {
      name: true,
      slug: true
    },
    orderBy: {
      name: "asc"
    },
    take: limit
  });
}

/** Just the fields a suggestion row renders — no descriptions, no variants. */
export async function findSuggestionProducts(productIds: string[]) {
  return prisma.product.findMany({
    where: {
      id: {
        in: productIds
      }
    },
    select: {
      id: true,
      price: true,
      slug: true,
      title: true,
      images: {
        select: {
          url: true
        },
        orderBy: {
          position: "asc"
        },
        take: 1
      }
    }
  });
}

export async function findSynonymGroups(storeId: string) {
  const groups = await prisma.searchSynonym.findMany({
    where: { storeId },
    select: { terms: true }
  });

  return groups.map((group) => group.terms);
}

export async function findBoostsForQuery(storeId: string, query: string) {
  return prisma.searchBoost.findMany({
    where: { query, storeId },
    select: { position: true, productId: true },
    orderBy: { position: "asc" }
  });
}

export async function findRedirectForQuery(storeId: string, query: string) {
  return prisma.searchRedirect.findFirst({
    where: { query, storeId },
    select: { targetUrl: true }
  });
}
