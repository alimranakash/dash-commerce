/**
 * A user's raw words turned into the two forms Postgres needs: a `tsquery`
 * string for full-text matching and the untouched text for boosts.
 *
 * `to_tsquery` parses operators (`&`, `|`, `!`, `:`, parentheses) and throws on
 * malformed input, so tokens are reduced to word characters before they are
 * ever concatenated into one.
 *
 * Marks (`\p{M}`) and the two joiners have to survive alongside letters and
 * digits, or Bangla is destroyed rather than tokenised: its vowel signs are
 * combining marks, not letters, so a letters-only filter turns "কেটলি" into
 * "ক টল" — three fragments that match nothing. The joiners do the same job for
 * conjuncts — written as \u200C/\u200D escapes rather than as the characters
 * themselves, which are invisible in the source and which an editor or a
 * careless paste can drop without leaving a trace in the diff. None of them
 * are `tsquery` operators, so keeping them is safe.
 */
const DISALLOWED_CHARACTERS = /[^\p{L}\p{N}\p{M}\u200C\u200D]+/gu;

export type SearchTokens = {
  /** Every word the shopper typed, sanitised, in order. */
  tokens: string[];
};

export function tokenizeSearchQuery(query: string): SearchTokens {
  return {
    tokens: query
      .replace(DISALLOWED_CHARACTERS, " ")
      .split(" ")
      .map((token) => token.trim())
      .filter((token) => token.length > 0)
  };
}

/**
 * Both builders take *fragments*, not raw tokens: by the time a query is
 * assembled each word has been through synonym expansion, so a fragment may
 * already be a parenthesised alternation like `(jama | dress)` or carry the
 * `:*` that makes a half-typed word match as a prefix.
 */

/** `red & shirt` — every word must appear. */
export function buildAllTermsQuery(fragments: string[]) {
  return fragments.join(" & ");
}

/** `red | shirt` — any word may appear, ranking sorts out which matched more. */
export function buildAnyTermQuery(fragments: string[]) {
  return fragments.join(" | ");
}
