import { findServableCustomDomain } from "./domains.repository";
import { normalizeDomainInput, validateDomainHostname } from "./domains.schema";

/**
 * Host-to-store lookup for request routing.
 *
 * This runs in `proxy.ts`, so it is on the path of *every* request to a custom
 * domain — including requests to hostnames nobody has configured, since anyone
 * can point DNS at this server. Hence the short-lived cache, and the negative
 * cache: an unknown host must cost no more than a known one.
 *
 * The cache is per Node process, so with several app instances behind Caddy each
 * keeps its own. That is fine because the only staleness it can produce is a
 * newly verified domain taking up to a TTL to start serving; `invalidateDomain`
 * covers the common single-instance case immediately.
 */

const RESOLVED_TTL_MS = 60_000;
const UNRESOLVED_TTL_MS = 15_000;
/** Bounds memory when a bot walks many hostnames pointed at this IP. */
const MAX_CACHE_ENTRIES = 500;

type CacheEntry = {
  expiresAt: number;
  slug: string | null;
};

const cache = new Map<string, CacheEntry>();

export type CustomDomainRoute = {
  domain: string;
  slug: string;
};

/**
 * Resolves a `Host` header to the store it may serve, or `null` when the
 * hostname is unknown, unverified, or belongs to an archived store.
 *
 * Fails closed by construction: the only query it makes already requires a
 * verified `CUSTOM` row on a live store.
 */
export async function resolveCustomDomainRoute(
  hostname: string
): Promise<CustomDomainRoute | null> {
  const domain = normalizeDomainInput(hostname);

  // A malformed or platform-owned Host header never reaches the database.
  if (validateDomainHostname(domain)) {
    return null;
  }

  const cached = cache.get(domain);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.slug ? { domain, slug: cached.slug } : null;
  }

  const match = await findServableCustomDomain(domain);
  const slug = match?.store.slug ?? null;

  if (cache.size >= MAX_CACHE_ENTRIES) {
    cache.clear();
  }

  cache.set(domain, {
    expiresAt: Date.now() + (slug ? RESOLVED_TTL_MS : UNRESOLVED_TTL_MS),
    slug
  });

  return slug ? { domain, slug } : null;
}

/**
 * Drops a hostname from the cache. Called whenever a domain is added, removed,
 * verified, or unverified, so a seller who just verified their DNS does not have
 * to wait out the negative TTL.
 */
export function invalidateCustomDomainRoute(hostname: string) {
  cache.delete(normalizeDomainInput(hostname));
}
