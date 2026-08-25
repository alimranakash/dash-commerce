import { NextResponse, type NextRequest } from "next/server";
import { normalizeHostname, resolveStoreFromHost } from "./lib/host-routing";
import { resolveCustomDomainRoute } from "./modules/domains/domain-routing";

const PUBLIC_FILE = /\.(.*)$/;
const SELLER_APP_PATHS = [
  "/admin",
  "/dashboard",
  "/invite",
  "/login",
  "/register",
  "/reset-password"
];
/** Where an unknown or unverified custom domain lands. */
const DOMAIN_NOT_CONFIGURED_PATH = "/domain-not-configured";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (shouldSkipProxy(pathname)) {
    return NextResponse.next();
  }

  const canonicalRedirect = redirectToCanonicalAuthOrigin(request, pathname);

  if (canonicalRedirect) {
    return canonicalRedirect;
  }

  const hostRoute = resolveStoreFromHost(request.headers.get("host") ?? request.nextUrl.hostname);

  if (hostRoute.type !== "storefront" && hostRoute.type !== "custom-domain") {
    return NextResponse.next();
  }

  if (isSellerAppPath(pathname)) {
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
 * Pins the seller app to the one origin NextAuth signs its cookies for.
 *
 * `/login` and its siblings are exempt from the storefront rewrite, so they
 * render on *any* hostname this server answers on — including `storeim.com`,
 * whose landing page links to a relative `/login`. That is harmless for the
 * password form and fatal for Google.
 *
 * `next-auth/react` posts to a *relative* `/api/auth/signin/google`, so the
 * `state` and `pkce.code_verifier` cookies are written on whichever hostname the
 * page was served from. The `redirect_uri` handed to Google is built server-side
 * from `NEXTAUTH_URL` instead, so the browser returns to the app host — where
 * those two cookies do not exist. NextAuth fails the callback with "State cookie
 * was missing." and bounces to `/login?error=OAuthCallback`, which is why the
 * sign-in only breaks for visitors who arrived from the marketing site instead
 * of typing the app host: on mobile, most of them.
 *
 * Moving the page to the canonical origin first puts the cookies where the
 * callback will look for them. `NEXTAUTH_URL` is the source of truth rather than
 * `PLATFORM_APP_HOST` because it is the value NextAuth actually derives the
 * `redirect_uri` from, and a deployment where the two disagree would reintroduce
 * the bug. Unset, unparseable, or already matching leaves the request alone, so
 * `localhost:3000` in development is untouched.
 */
function redirectToCanonicalAuthOrigin(request: NextRequest, pathname: string) {
  if (!isSellerAppPath(pathname)) {
    return null;
  }

  const canonicalOrigin = getCanonicalAuthOrigin();

  if (!canonicalOrigin) {
    return null;
  }

  const host = normalizeHostname(request.headers.get("host") ?? request.nextUrl.hostname);

  if (!host || host === normalizeHostname(canonicalOrigin.host)) {
    return null;
  }

  // 307 rather than 308: the target comes from the environment, and a permanent
  // redirect cached on a phone would outlive any change to NEXTAUTH_URL.
  return NextResponse.redirect(
    new URL(`${pathname}${request.nextUrl.search}`, canonicalOrigin.origin),
    307
  );
}

function getCanonicalAuthOrigin() {
  const configuredUrl = process.env.NEXTAUTH_URL;

  if (!configuredUrl) {
    return null;
  }

  try {
    return new URL(configuredUrl);
  } catch {
    return null;
  }
}

function isSellerAppPath(pathname: string) {
  return SELLER_APP_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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
