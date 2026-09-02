/**
 * `robots.txt`, which is how a sitemap is discovered by a crawler nobody has
 * submitted it to. Same four surfaces the proxy routes by, and the same split.
 *
 * The disallow lists mirror what `sitemap.service.ts` leaves out, on purpose:
 * a URL omitted from the sitemap but left crawlable still gets crawled, and the
 * two files disagreeing is how a checkout page ends up in a search result.
 */

/** The shopper's own session. Nothing here is the same page twice. */
export const STOREFRONT_DISALLOWED_PATHS = [
  "/account",
  "/api/",
  "/cart",
  "/checkout",
  "/orders",
  "/search",
  "/thank-you",
  // One shopper's cookie rendered as a page. The page itself sends `noindex`;
  // this is the half that stops it being fetched at all.
  "/wishlist"
];

/**
 * The seller app and the internal rewrite target.
 *
 * `/s/<slug>` matters more than it looks: the proxy only rewrites storefront
 * hostnames, so on the marketing domain that path renders a full storefront —
 * a second, crawlable copy of every store under the platform's own domain.
 */
export const MARKETING_DISALLOWED_PATHS = [
  "/admin",
  "/api/",
  "/dashboard",
  "/invite",
  "/login",
  "/register",
  "/reset-password",
  "/s/"
];

export const ROBOTS_CONTENT_TYPE = "text/plain; charset=utf-8";

export function renderRobotsTxt(input: {
  disallow: readonly string[];
  sitemapUrl?: string | undefined;
}) {
  const lines = ["User-agent: *", "Allow: /", ...input.disallow.map((path) => `Disallow: ${path}`)];

  if (input.sitemapUrl) {
    lines.push("", `Sitemap: ${input.sitemapUrl}`);
  }

  return `${lines.join("\n")}\n`;
}

/**
 * For the seller app, and for a store that has not launched.
 *
 * A `DRAFT` store is servable — that is how a seller previews it before going
 * live — but it is a half-built shop, and a crawler that indexes it now is
 * still showing those pages after launch. No sitemap line either: there is
 * nothing to submit.
 */
export function renderDisallowAllRobotsTxt() {
  return "User-agent: *\nDisallow: /\n";
}
