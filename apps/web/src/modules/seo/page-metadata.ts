import { storeSubdomain } from "../../lib/host-routing";
import { getPrimaryStorefrontDomain } from "../storefront/resolver";

/**
 * How a storefront page tells a crawler which address it really lives at.
 *
 * The same page answers on up to three hostnames — the store's subdomain, its
 * custom domain, and in development the `/s/<slug>` path form — so without a
 * canonical every product is three URLs competing with each other. One store,
 * one address: whichever domain the seller made primary, which is the choice
 * `getPrimaryStorefrontDomain` already makes for the rest of the app.
 *
 * Deliberately *not* the origin a sitemap is built from. A sitemap may only
 * list URLs beneath its own location, so it uses the host it was requested on;
 * the canonical tag on each of those pages is what folds the subdomain's copy
 * into the custom domain's.
 */

/** Where Google truncates a description in a result snippet. */
const META_DESCRIPTION_LIMIT = 160;

type StorefrontCanonicalStore = Parameters<typeof getPrimaryStorefrontDomain>[0];

export function storefrontCanonicalOrigin(store: StorefrontCanonicalStore) {
  const primaryDomain = getPrimaryStorefrontDomain(store);

  return `https://${primaryDomain ? primaryDomain.domain : storeSubdomain(store.slug)}`;
}

export function storefrontCanonicalUrl(store: StorefrontCanonicalStore, path = "/") {
  return `${storefrontCanonicalOrigin(store)}${normalizeCanonicalPath(path)}`;
}

/**
 * A page's own description, from whatever prose the seller already wrote.
 *
 * Product and category descriptions can carry markup, and a snippet showing
 * `<p>` tags is worse than no snippet at all, so tags come out before the text
 * is measured. Truncation lands on a word boundary, and an empty description
 * falls back to the caller's sentence rather than to nothing.
 */
export function toMetaDescription(value: string | null | undefined, fallback: string) {
  const text = (value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) {
    return fallback;
  }

  if (text.length <= META_DESCRIPTION_LIMIT) {
    return text;
  }

  const clipped = text.slice(0, META_DESCRIPTION_LIMIT);
  const lastSpace = clipped.lastIndexOf(" ");

  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}…`;
}

function normalizeCanonicalPath(path: string) {
  if (!path || path === "/") {
    return "";
  }

  return path.startsWith("/") ? path : `/${path}`;
}
