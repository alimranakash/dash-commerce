import { cache } from "react";
import { buildAllTermsQuery, buildAnyTermQuery, tokenizeSearchQuery } from "./search-query";
import { normalizeSearchRule } from "./search-admin.schema";
import { expandToken, getSynonymIndex } from "./search-synonyms";
import {
  findBoostsForQuery,
  findProductsByFuzzyTitle,
  findProductsByTextQuery,
  findRedirectForQuery,
  findSuggestedCategories,
  findSuggestionProducts
} from "./search.repository";
import type { RankedProductMatch } from "./search.repository";
import {
  SEARCH_CANDIDATE_LIMIT,
  searchSuggestInputSchema,
  storefrontSearchInputSchema
} from "./search.schema";

export type SearchStrategy = "all-terms" | "any-term" | "fuzzy" | "none";

export type StorefrontSearchResult = {
  matches: RankedProductMatch[];
  /**
   * Set when the shopper's words matched nothing and results come from typo
   * correction instead, so the page can say what it actually searched for.
   */
  correctedQuery: string | null;
  strategy: SearchStrategy;
};

const EMPTY_RESULT: StorefrontSearchResult = {
  matches: [],
  correctedQuery: null,
  strategy: "none"
};

/**
 * Ranked product ids for a shopper's query, widening the net only as far as it
 * has to.
 *
 * Requiring every word is what makes "wireless headphones" mean wireless
 * headphones, so that is tried first. A shopper who typed a word the catalogue
 * does not use ("cheap wireless headphones") would get nothing from that, so
 * the second pass accepts any word and lets ranking float the products that
 * matched most of them. Typo correction is last because it is the only pass
 * that can put a product the shopper did not ask for at the top.
 *
 * Seller rules bracket the whole thing: synonyms widen what each word matches
 * before any pass runs, and pinned products are applied to whatever comes back.
 */
export async function searchStorefrontProducts(
  storeId: string,
  input: { limit?: number | undefined; prefix?: boolean | undefined; query: string }
): Promise<StorefrontSearchResult> {
  const parsed = storefrontSearchInputSchema.safeParse({
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    query: input.query
  });

  if (!parsed.success) {
    return EMPTY_RESULT;
  }

  const { limit, query } = parsed.data;
  const { tokens } = tokenizeSearchQuery(query);

  if (tokens.length === 0) {
    return EMPTY_RESULT;
  }

  const synonyms = await getSynonymIndex(storeId);
  const fragments = tokens.map((token, index) =>
    expandToken(token, synonyms, Boolean(input.prefix) && index === tokens.length - 1)
  );
  const result = await runSearchPasses(storeId, query, tokens, fragments, limit);

  return applyBoosts(storeId, query, result);
}

async function runSearchPasses(
  storeId: string,
  query: string,
  tokens: string[],
  fragments: string[],
  limit: number
): Promise<StorefrontSearchResult> {
  const allTermMatches = await findProductsByTextQuery(
    storeId,
    query,
    buildAllTermsQuery(fragments),
    limit
  );

  if (allTermMatches.length > 0) {
    return { matches: allTermMatches, correctedQuery: null, strategy: "all-terms" };
  }

  if (tokens.length > 1) {
    const anyTermMatches = await findProductsByTextQuery(
      storeId,
      query,
      buildAnyTermQuery(fragments),
      limit
    );

    if (anyTermMatches.length > 0) {
      return { matches: anyTermMatches, correctedQuery: null, strategy: "any-term" };
    }
  }

  const fuzzyMatches = await findProductsByFuzzyTitle(storeId, query, limit);

  if (fuzzyMatches.length === 0) {
    return EMPTY_RESULT;
  }

  return { matches: fuzzyMatches, correctedQuery: query, strategy: "fuzzy" };
}

/**
 * Moves the seller's pinned products to the front for this exact query.
 *
 * A pin is an override, so it wins over the score outright, and it holds even
 * when the product would not have matched at all — that is the point of pinning
 * something to a term the catalogue does not use. The ids only ever narrow the
 * caller's own query, which still enforces active + public, so a pin cannot
 * expose a hidden product.
 */
async function applyBoosts(
  storeId: string,
  query: string,
  result: StorefrontSearchResult
): Promise<StorefrontSearchResult> {
  const boosts = await findBoostsForQuery(storeId, normalizeSearchRule(query));

  if (boosts.length === 0) {
    return result;
  }

  const topRank = result.matches[0]?.rank ?? 1;
  const pinnedIds = new Set(boosts.map((boost) => boost.productId));
  const pinned = boosts.map((boost, index) => ({
    productId: boost.productId,
    rank: topRank + boosts.length - index
  }));

  return {
    ...result,
    matches: [...pinned, ...result.matches.filter((match) => !pinnedIds.has(match.productId))]
  };
}

/**
 * Request-scoped memo of a storefront search.
 *
 * A single search page render asks the same question from three places — the
 * product list, the result count, and the banner that explains a typo-corrected
 * result — and each pass costs a full-text query. `cache` collapses them into
 * one round trip for the duration of the request, so the arguments are kept
 * primitive to stay comparable by identity.
 */
export const getSearchResultsForStore = cache(async (storeId: string, query: string) =>
  searchStorefrontProducts(storeId, { limit: SEARCH_CANDIDATE_LIMIT, query })
);

/** Ranked product ids only, in relevance order, for callers that just filter. */
export async function findRelevantProductIds(
  storeId: string,
  query: string,
  limit = SEARCH_CANDIDATE_LIMIT
) {
  const result = await searchStorefrontProducts(storeId, { limit, query });

  return result.matches.map((match) => match.productId);
}

export type SearchSuggestionProduct = {
  id: string;
  imageUrl: string | null;
  price: string;
  slug: string;
  title: string;
};

export type SearchSuggestions = {
  categories: Array<{ name: string; slug: string }>;
  products: SearchSuggestionProduct[];
  /** Total matches behind the truncated list, for the "see all" link. */
  totalProducts: number;
};

/**
 * Powers the header dropdown. Runs in prefix mode so a half-typed word still
 * matches, and asks for a wider candidate set than it shows so the "see all"
 * count is not just the size of the visible list.
 */
export async function getStorefrontSearchSuggestions(
  storeId: string,
  input: { limit?: number | undefined; query: string }
): Promise<SearchSuggestions> {
  const parsed = searchSuggestInputSchema.safeParse({
    ...(input.limit === undefined ? {} : { limit: input.limit }),
    query: input.query
  });

  if (!parsed.success) {
    return { categories: [], products: [], totalProducts: 0 };
  }

  const { limit, query } = parsed.data;
  const [{ matches }, categories] = await Promise.all([
    searchStorefrontProducts(storeId, { limit: SEARCH_CANDIDATE_LIMIT, prefix: true, query }),
    findSuggestedCategories(storeId, query, 3)
  ]);

  if (matches.length === 0) {
    return { categories, products: [], totalProducts: 0 };
  }

  const relevant = withoutWeakMatches(matches);
  const ranks = new Map(relevant.map((match) => [match.productId, match.rank]));
  const rows = await findSuggestionProducts([...ranks.keys()].slice(0, limit * 3));
  const products = rows
    .sort((first, second) => (ranks.get(second.id) ?? 0) - (ranks.get(first.id) ?? 0))
    .slice(0, limit)
    .map((product) => ({
      id: product.id,
      imageUrl: product.images[0]?.url ?? null,
      price: product.price.toString(),
      slug: product.slug,
      title: product.title
    }));

  return { categories, products, totalProducts: matches.length };
}

/**
 * Drops matches far weaker than the best one.
 *
 * Because descriptions are part of the indexed document, typing "head" also
 * matches a lamp whose description mentions a headboard. That is a fair result
 * on a results page, but in a six-row dropdown it pushes out things the shopper
 * meant. The gap is stark enough to key on — a title hit scores an order of
 * magnitude above an incidental description hit — so anything under a quarter
 * of the leader is left for the full results page to show.
 */
function withoutWeakMatches(matches: RankedProductMatch[]) {
  const topRank = matches[0]?.rank ?? 0;

  if (topRank <= 0) {
    return matches;
  }

  return matches.filter((match) => match.rank >= topRank * 0.25);
}

/**
 * A seller rule that sends this query somewhere else entirely, or null.
 *
 * Checked before results are fetched: if a query is redirected, the search that
 * would have been run is wasted work.
 */
export const getSearchRedirect = cache(async (storeId: string, query: string) => {
  const rule = await findRedirectForQuery(storeId, normalizeSearchRule(query));

  return rule?.targetUrl ?? null;
});
