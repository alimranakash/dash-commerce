import { cache } from "react";
import { findSynonymGroups } from "./search.repository";
import { tokenizeSearchQuery } from "./search-query";

/**
 * Lookup from any term a shopper might type to every term that means the same
 * thing, itself included.
 *
 * Groups are two-way by definition, so each term in a group maps to the whole
 * group. A term appearing in two groups gets the union of both — a seller who
 * writes overlapping groups almost certainly means them to chain.
 */
export type SynonymIndex = Map<string, string[]>;

export const getSynonymIndex = cache(async (storeId: string): Promise<SynonymIndex> => {
  const groups = await findSynonymGroups(storeId);
  const index: SynonymIndex = new Map();

  for (const group of groups) {
    for (const term of group) {
      const existing = index.get(term) ?? [];

      index.set(term, Array.from(new Set([...existing, ...group])));
    }
  }

  return index;
});

/**
 * Rewrites one shopper token into the tsquery fragment that also accepts its
 * synonyms.
 *
 * A synonym may be several words ("power bank"), which cannot be dropped into a
 * tsquery as-is, so every alternative is tokenised and re-joined with `&`. The
 * whole fragment is parenthesised because it sits inside an `&` chain — without
 * the parentheses the alternation would swallow the neighbouring terms.
 */
export function expandToken(token: string, index: SynonymIndex, prefix: boolean) {
  const alternatives = index.get(token.toLowerCase());

  if (!alternatives || alternatives.length < 2) {
    return prefix ? `${token}:*` : token;
  }

  const fragments = alternatives
    .map((alternative) => {
      const { tokens } = tokenizeSearchQuery(alternative);

      if (tokens.length === 0) {
        return null;
      }

      // Only the shopper's own word gets prefix treatment: they are still
      // typing that one, but a synonym is a complete word by construction.
      const words = tokens.map((word, wordIndex) =>
        prefix &&
        alternative.toLowerCase() === token.toLowerCase() &&
        wordIndex === tokens.length - 1
          ? `${word}:*`
          : word
      );

      return words.length > 1 ? `(${words.join(" & ")})` : words[0];
    })
    .filter((fragment): fragment is string => Boolean(fragment));

  if (fragments.length === 0) {
    return prefix ? `${token}:*` : token;
  }

  return `(${fragments.join(" | ")})`;
}
