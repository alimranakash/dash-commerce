/**
 * The platform's own hostnames.
 *
 * Env-driven because a real deployment does not run on `dash.com`: the same build
 * has to answer on the operator's domain, and both request routing and the
 * on-demand TLS authorisation endpoint have to agree on which names are ours.
 * Defaults keep local development and the existing fixtures working unchanged.
 *
 *   PLATFORM_ROOT_DOMAIN   marketing site + the root tenant subdomains hang off it
 *   PLATFORM_APP_HOST      seller app + platform admin (defaults to app.<root>)
 */
const platformRootDomain = normalizeHostname(process.env.PLATFORM_ROOT_DOMAIN ?? "dash.com");
const platformAppHost = normalizeHostname(
  process.env.PLATFORM_APP_HOST ?? `app.${platformRootDomain}`
);

const ROOT_HOSTS = new Set([platformRootDomain, `www.${platformRootDomain}`]);
const APP_HOSTS = new Set([platformAppHost]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin"]);

/** The root the platform's own subdomains hang off. */
export const PLATFORM_ROOT_DOMAIN = platformRootDomain;

export function getPlatformRootDomain() {
  return platformRootDomain;
}

/**
 * True for any hostname the platform already answers on — its root, the seller
 * app, localhost, and the whole `*.<root>` / `*.localhost` tenant space.
 *
 * A seller must never be able to register one of these as a custom domain: the
 * `StoreDomain.domain` column is globally unique, so claiming the app host would
 * let one store squat a hostname the platform routes by other rules.
 */
export function isPlatformHostname(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname);

  return (
    ROOT_HOSTS.has(normalizedHostname) ||
    APP_HOSTS.has(normalizedHostname) ||
    LOCAL_HOSTS.has(normalizedHostname) ||
    normalizedHostname.endsWith(`.${platformRootDomain}`) ||
    normalizedHostname === platformRootDomain ||
    normalizedHostname.endsWith(".localhost")
  );
}

/**
 * The platform's *fixed* hostnames only — root, www, and the app host.
 *
 * Deliberately narrower than `isPlatformHostname`: it excludes the `*.<root>`
 * wildcard. Certificate issuance may only be authorised for names that certainly
 * exist, and anyone can open a TLS handshake with an invented SNI of
 * `whatever.<root>` even though no such DNS record exists. Tenant subdomains are
 * therefore checked against the database instead.
 */
export function isPlatformFixedHostname(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname);

  return ROOT_HOSTS.has(normalizedHostname) || APP_HOSTS.has(normalizedHostname);
}

export type HostRoute =
  | {
      type: "marketing";
    }
  | {
      type: "seller-app";
    }
  | {
      type: "storefront";
      slug: string;
    }
  | {
      domain: string;
      type: "custom-domain";
    };

export function resolveStoreFromHost(hostname: string): HostRoute {
  const normalizedHostname = normalizeHostname(hostname);

  if (ROOT_HOSTS.has(normalizedHostname) || LOCAL_HOSTS.has(normalizedHostname)) {
    return {
      type: "marketing"
    };
  }

  if (APP_HOSTS.has(normalizedHostname)) {
    return {
      type: "seller-app"
    };
  }

  const platformSlug = getSubdomainSlug(normalizedHostname, platformRootDomain);

  if (platformSlug) {
    return {
      type: "storefront",
      slug: platformSlug
    };
  }

  const localhostSlug = getSubdomainSlug(normalizedHostname, "localhost");

  if (localhostSlug) {
    return {
      type: "storefront",
      slug: localhostSlug
    };
  }

  if (isCustomDomainCandidate(normalizedHostname)) {
    return {
      domain: normalizedHostname,
      type: "custom-domain"
    };
  }

  return {
    type: "marketing"
  };
}

export function normalizeHostname(hostname: string) {
  return hostname.split(":")[0]?.toLowerCase() ?? "";
}

function getSubdomainSlug(hostname: string, rootDomain: string) {
  if (!hostname.endsWith(`.${rootDomain}`)) {
    return null;
  }

  const slug = hostname.slice(0, -1 * (`.${rootDomain}`.length));

  if (!slug || slug.includes(".") || RESERVED_SUBDOMAINS.has(slug)) {
    return null;
  }

  return slug;
}

function isCustomDomainCandidate(hostname: string) {
  return hostname.includes(".") && !LOCAL_HOSTS.has(hostname);
}
