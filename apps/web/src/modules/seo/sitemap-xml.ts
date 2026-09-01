/**
 * The XML half of the sitemaps: no Prisma, no Next, no request.
 *
 * Kept pure so `verify:sitemap` can drive the exact documents a crawler will be
 * served without a database, which is the only executable check this repo has.
 *
 * Both documents the sitemaps protocol defines live here — a `<urlset>` of
 * pages, and a `<sitemapindex>` of further sitemaps — plus the Google image
 * extension, because a product without its photo in the sitemap is a product
 * Image Search has to discover by crawling the page instead.
 */

/** The protocol's hard ceiling per document: 50,000 URLs or 50MB uncompressed. */
export const SITEMAP_MAX_URLS = 50_000;

/**
 * How many URLs one product sitemap carries.
 *
 * Deliberately a tenth of the ceiling. Each section is one HTTP request that
 * runs a query and serialises the result, so the number that matters is not the
 * protocol limit but how long a single response takes — and a store that grows
 * past 5,000 products gets more small sitemaps rather than one slow one.
 */
export const SITEMAP_URLS_PER_SECTION = 5_000;

/** Images per product. The first few are the gallery's lead shots. */
export const SITEMAP_IMAGES_PER_URL = 3;

export type SitemapChangeFrequency =
  | "always"
  | "daily"
  | "hourly"
  | "monthly"
  | "never"
  | "weekly"
  | "yearly";

export type SitemapUrl = {
  changeFrequency?: SitemapChangeFrequency | undefined;
  imageUrls?: string[] | undefined;
  lastModified?: Date | null | undefined;
  loc: string;
  priority?: number | undefined;
};

export type SitemapIndexEntry = {
  lastModified?: Date | null | undefined;
  loc: string;
};

export const SITEMAP_CONTENT_TYPE = "application/xml; charset=utf-8";

export function renderSitemapUrlSet(urls: SitemapUrl[]) {
  // The image namespace is only declared when something uses it, so a store
  // with no product photos still validates against the plain sitemap schema.
  const imageNamespace = urls.some((url) => (url.imageUrls?.length ?? 0) > 0)
    ? ' xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
    : "";

  return renderDocument(
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"${imageNamespace}>`,
    urls.map(renderSitemapUrl),
    "</urlset>"
  );
}

export function renderSitemapIndex(entries: SitemapIndexEntry[]) {
  return renderDocument(
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    entries.map(renderSitemapIndexEntry),
    "</sitemapindex>"
  );
}

/**
 * Escapes the five characters XML reserves.
 *
 * Slugs are the seller's own input, so this is not a formality: one `&` in a
 * category slug is the difference between a sitemap and a parse error that
 * takes the whole document with it.
 */
export function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** W3C datetime, which is what `<lastmod>` accepts. Invalid dates are dropped. */
export function formatSitemapDate(value: Date | null | undefined) {
  if (!value || Number.isNaN(value.getTime())) {
    return null;
  }

  return value.toISOString();
}

function renderDocument(open: string, entries: string[], close: string) {
  return `${['<?xml version="1.0" encoding="UTF-8"?>', open, ...entries, close].join("\n")}\n`;
}

function renderSitemapUrl(url: SitemapUrl) {
  const lines = [`    <loc>${escapeXml(url.loc)}</loc>`];
  const lastModified = formatSitemapDate(url.lastModified);

  if (lastModified) {
    lines.push(`    <lastmod>${lastModified}</lastmod>`);
  }

  if (url.changeFrequency) {
    lines.push(`    <changefreq>${url.changeFrequency}</changefreq>`);
  }

  if (typeof url.priority === "number") {
    lines.push(`    <priority>${formatSitemapPriority(url.priority)}</priority>`);
  }

  for (const imageUrl of url.imageUrls ?? []) {
    lines.push(
      "    <image:image>",
      `      <image:loc>${escapeXml(imageUrl)}</image:loc>`,
      "    </image:image>"
    );
  }

  return ["  <url>", ...lines, "  </url>"].join("\n");
}

function renderSitemapIndexEntry(entry: SitemapIndexEntry) {
  const lines = [`    <loc>${escapeXml(entry.loc)}</loc>`];
  const lastModified = formatSitemapDate(entry.lastModified);

  if (lastModified) {
    lines.push(`    <lastmod>${lastModified}</lastmod>`);
  }

  return ["  <sitemap>", ...lines, "  </sitemap>"].join("\n");
}

function formatSitemapPriority(priority: number) {
  return Math.min(1, Math.max(0, priority)).toFixed(1);
}
