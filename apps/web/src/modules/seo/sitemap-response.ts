/**
 * How long a sitemap or `robots.txt` may be reused.
 *
 * These are rebuilt from the database on every miss, and a crawler can walk
 * many of them in a burst, so they are worth caching — but the browser gets
 * none of it. `max-age=0` keeps a seller from seeing yesterday's sitemap while
 * checking their own store; `s-maxage` is what Caddy or a CDN in front of the
 * app holds, and `stale-while-revalidate` means a catalogue change costs one
 * slow revalidation in the background rather than a slow response.
 */
const SHARED_MAX_AGE_SECONDS = 60 * 60;
const STALE_WHILE_REVALIDATE_SECONDS = 60 * 60 * 24;

export function sitemapCacheHeader() {
  return `public, max-age=0, s-maxage=${SHARED_MAX_AGE_SECONDS}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;
}
