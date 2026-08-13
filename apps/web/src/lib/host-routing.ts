const ROOT_HOSTS = new Set(["dash.com", "www.dash.com"]);
const APP_HOSTS = new Set(["app.dash.com"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin"]);

/** The root the platform's own subdomains hang off. */
export const PLATFORM_ROOT_DOMAIN = "dash.com";

/**
 * True for any hostname the platform already answers on — its root, the seller
 * app, localhost, and the whole `*.dash.com` / `*.localhost` tenant space.
 *
 * A seller must never be able to register one of these as a custom domain: the
 * `StoreDomain.domain` column is globally unique, so claiming `app.dash.com`
 * would let one store squat a hostname the platform routes by other rules.
 */
export function isPlatformHostname(hostname: string) {
  const normalizedHostname = normalizeHostname(hostname);

  return (
    ROOT_HOSTS.has(normalizedHostname) ||
    APP_HOSTS.has(normalizedHostname) ||
    LOCAL_HOSTS.has(normalizedHostname) ||
    normalizedHostname.endsWith(`.${PLATFORM_ROOT_DOMAIN}`) ||
    normalizedHostname === PLATFORM_ROOT_DOMAIN ||
    normalizedHostname.endsWith(".localhost")
  );
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

  const dashSlug = getSubdomainSlug(normalizedHostname, "dash.com");

  if (dashSlug) {
    return {
      type: "storefront",
      slug: dashSlug
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
