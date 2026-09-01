/**
 * URL helpers shared by the sitemaps and the canonical tags, kept apart from
 * both so neither has to import the other's dependencies.
 */

/**
 * Percent-encodes one path segment.
 *
 * Slugs are the seller's own input. `encodeURIComponent` over a whole path
 * would eat the separators, and leaving a slug raw puts a space or a `?`
 * straight into a `<loc>` and a canonical tag.
 */
export function encodeUrlPathSegment(segment: string) {
  return encodeURIComponent(segment);
}

/** Joins already-encoded segments into a path, e.g. `getting-started/basics`. */
export function encodeUrlPath(path: string) {
  return path.split("/").map(encodeUrlPathSegment).join("/");
}

/**
 * Absolute URL for a path, or null when the input cannot become one.
 *
 * Every `<loc>` in a sitemap and every `og:image` has to be absolute, and
 * product images are stored as the relative `/uploads/...` key the media route
 * serves. `data:` URIs are dropped rather than inlined: they are not addresses
 * a crawler can fetch, and one embedded image would outweigh the document
 * carrying it.
 */
export function toAbsoluteUrl(origin: string, path: string) {
  const trimmed = path.trim();

  if (!trimmed || trimmed.toLowerCase().startsWith("data:")) {
    return null;
  }

  try {
    const url = new URL(trimmed, origin);

    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
