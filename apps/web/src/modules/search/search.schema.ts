import { z } from "zod";

/** Upper bound on the ranked candidate set a single search may consider. */
export const SEARCH_CANDIDATE_LIMIT = 400;

export const storefrontSearchInputSchema = z.object({
  limit: z.number().int().positive().max(SEARCH_CANDIDATE_LIMIT).default(SEARCH_CANDIDATE_LIMIT),
  query: z.string().trim().min(1).max(120)
});

export type StorefrontSearchInput = z.infer<typeof storefrontSearchInputSchema>;

export const searchSuggestInputSchema = z.object({
  limit: z.number().int().positive().max(10).default(6),
  query: z.string().trim().min(1).max(120)
});

export type SearchSuggestInput = z.infer<typeof searchSuggestInputSchema>;
