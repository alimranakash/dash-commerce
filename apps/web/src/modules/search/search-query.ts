/**
 * A user's raw words turned into the two forms Postgres needs: a `tsquery`
 * string for full-text matching and the untouched text for boosts.
 *
 * `to_tsquery` parses operators (`&`, `|`, `!`, `:`, parentheses) and throws on
 * malformed input, so tokens are stripped down to letters and digits before
 * they are ever concatenated into one. `\p{L}` keeps Bangla intact, which
 * `\w` would not.
 */
const DISALLOWED_CHARACTERS = /[^\p{L}\p{N}]+/gu;

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
