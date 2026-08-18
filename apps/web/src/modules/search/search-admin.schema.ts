import { z } from "zod";

/**
 * Queries are matched by exact string, so both the seller's rule and the
 * shopper's input have to be reduced the same way before they can meet.
 */
export function normalizeSearchRule(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

const ruleQuery = z
  .string()
  .trim()
  .min(1, "Enter the search term this rule applies to.")
  .max(120)
  .transform(normalizeSearchRule);

export const synonymGroupSchema = z.object({
  terms: z
    .string()
    .trim()
    .min(1, "Enter at least two comma-separated terms.")
    .transform((value) =>
      Array.from(
        new Set(
          value
            .split(",")
            .map((term) => normalizeSearchRule(term))
            .filter((term) => term.length > 0)
        )
      )
    )
    .refine((terms) => terms.length >= 2, "A synonym group needs at least two different terms.")
    .refine((terms) => terms.length <= 25, "Keep a group to 25 terms or fewer.")
});

export type SynonymGroupInput = z.infer<typeof synonymGroupSchema>;

export const searchBoostSchema = z.object({
  productId: z.string().trim().min(1, "Pick a product to pin."),
  query: ruleQuery
});

export type SearchBoostInput = z.infer<typeof searchBoostSchema>;

export const searchRedirectSchema = z.object({
  query: ruleQuery,
  targetUrl: z
    .string()
    .trim()
    .min(1, "Enter where this search should go.")
    .max(500)
    .refine(
      (value) => value.startsWith("/") || /^https?:\/\//i.test(value),
      "Use a path like /pages/shipping or a full https:// URL."
    )
});

export type SearchRedirectInput = z.infer<typeof searchRedirectSchema>;
