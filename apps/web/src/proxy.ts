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
    return rewriteToStorefront(request, hostRoute.slug, pathname);
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

  const slugPrefix = `/s/${route.slug}`;

  /**
   * Storefront components link to `/s/<slug>/…` everywhere, which is the right
   * URL on `<slug>.dash.com` but leaks the internal path on a custom domain. So
   * the slug prefix is redirected away rather than served: the customer's address
   * bar keeps the clean `worzen.com/products` form, and the 121 existing hrefs
   * need no change.
   *
   * Only *this* store's prefix is stripped. A `/s/<other-store>` path falls
   * through to the rewrite below, produces no matching route, and 404s — a
   * custom domain never serves another tenant.
   */
  if (pathname === slugPrefix || pathname.startsWith(`${slugPrefix}/`)) {
    return redirectOnSameHost(request, pathname.slice(slugPrefix.length) || "/");
  }

  return rewriteToStorefront(request, route.slug, pathname);
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
