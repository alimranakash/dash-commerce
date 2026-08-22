import { NextResponse, type NextRequest } from "next/server";
import { resolveStoreFromHost } from "./lib/host-routing";
import { resolveCustomDomainRoute } from "./modules/domains/domain-routing";

const PUBLIC_FILE = /\.(.*)$/;
const SELLER_APP_PATHS = ["/admin", "/dashboard", "/invite", "/login", "/register"];
/** Where an unknown or unverified custom domain lands. */
const DOMAIN_NOT_CONFIGURED_PATH = "/domain-not-configured";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipProxy(pathname)) {
    return NextResponse.next();
  }

  const hostRoute = resolveStoreFromHost(request.headers.get("host") ?? request.nextUrl.hostname);

  if (hostRoute.type !== "storefront" && hostRoute.type !== "custom-domain") {
    return NextResponse.next();
  }

  if (SELLER_APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))) {
    return NextResponse.next();
  }

  if (hostRoute.type === "storefront") {
    return (
      redirectAwaySlugPrefix(request, hostRoute.slug, pathname) ??
      rewriteToStorefront(request, hostRoute.slug, pathname)
    );
  }

  // Custom domains are resolved against the database — only a verified hostname
  // on a live store gets to serve a storefront.
  const route = await resolveCustomDomainRoute(hostRoute.domain);

  if (!route) {
    const url = request.nextUrl.clone();

    url.pathname = DOMAIN_NOT_CONFIGURED_PATH;
    url.search = "";

    return NextResponse.rewrite(url);
  }

  return (
    redirectAwaySlugPrefix(request, route.slug, pathname) ??
    rewriteToStorefront(request, route.slug, pathname)
  );
}

/**
 * Sends `/s/<slug>/…` back to the bare path on the hostname it arrived on.
 *
 * Storefront components link to `/s/<slug>/…` everywhere. That is the rewrite
 * target, not a servable address on either storefront hostname: rewriting it a
 * second time prefixes another `/s/<slug>`, which matches no route and 404s. So
 * the prefix is redirected away rather than served, which also keeps the
 * customer's address bar on the clean `ds-shop.storeim.com/categories/haircare`
 * form and leaves the existing hrefs untouched.
 *
 * Only *this* store's prefix is stripped. A `/s/<other-store>` path returns null,
 * falls through to the rewrite, produces no matching route, and 404s — a
 * storefront never serves another tenant.
 */
function redirectAwaySlugPrefix(request: NextRequest, slug: string, pathname: string) {
  const slugPrefix = `/s/${slug}`;

  if (pathname === slugPrefix || pathname.startsWith(`${slugPrefix}/`)) {
    return redirectOnSameHost(request, pathname.slice(slugPrefix.length) || "/");
  }

  return null;
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"]
};

/**
 * Redirects within the hostname the customer actually asked for.
 *
 * `request.nextUrl` is not reliable for this: behind a reverse proxy — and in
 * `next dev` — its host can be the server's own origin rather than the browser's,
 * which would bounce a shopper off their store's domain. The `Host` header is the
 * browser's own, and by the time this is called that exact host has already been
 * matched to a verified domain in our database, so it cannot be used to redirect
 * anywhere we do not control.
 */
function redirectOnSameHost(request: NextRequest, pathname: string) {
  const host = request.headers.get("host") ?? request.nextUrl.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "") || "https";
  const location = new URL(`${pathname}${request.nextUrl.search}`, `${protocol}://${host}`);

  return NextResponse.redirect(location, 308);
}

/**
 * Both storefront surfaces render the same `app/storefront/[slug]/**` tree; `/s/`
 * is its rewrite target. Rewrites are internal, so this does not re-enter the
 * proxy and cannot loop.
 */
function rewriteToStorefront(request: NextRequest, slug: string, pathname: string) {
  const url = request.nextUrl.clone();

  // `nextUrl` takes its protocol from `x-forwarded-proto` but its host from the
  // address this server listens on, so behind Caddy it reads
  // `https://localhost:3000` — an origin that does not exist. Rewriting to it
  // makes Next open a real TLS connection to the plain-HTTP port, and every
  // storefront request 500s. The rewrite is internal, so the scheme of the
  // external hop is irrelevant: pin it to the one `next start` actually serves.
  url.protocol = "http:";
  url.pathname = `/s/${slug}${pathname === "/" ? "" : pathname}`;

  return NextResponse.rewrite(url);
}

function shouldSkipProxy(pathname: string) {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE.test(pathname)
  );
}
