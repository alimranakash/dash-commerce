const ROOT_HOSTS = new Set(["dash.com", "www.dash.com"]);
const APP_HOSTS = new Set(["app.dash.com"]);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin"]);

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
