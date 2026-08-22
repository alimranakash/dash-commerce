import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { resolveStoreFromHost } from "../../lib/host-routing";

/**
 * What storefront links should be prefixed with on the hostname being served.
 *
 * The same tree answers on three addresses, and only one of them wants the
 * internal prefix in the URL:
 *
 *   ds-shop.storeim.com   ""            the shopper's own address, kept clean
 *   worzen.com            ""            a seller's custom domain, likewise
 *   localhost:3000        "/s/ds-shop"  the path form, which is how the store is
 *                                       reachable with no subdomain to route by
 *
 * `<slug>.localhost` resolves as a storefront too, so a subdomain in development
 * behaves exactly like production rather than diverging.
 *
 * Server-only: it reads the request's `Host`. Client components take the result
 * as a prop — `PLATFORM_ROOT_DOMAIN` never reaches the browser bundle.
 */
export async function storefrontBasePath(slug: string | undefined) {
  // Some sections take the slug optionally. Without one there is no prefix to
  // build, and the clean form is the only one that can be correct — the old
  // code produced `/s/undefined/…` here.
  if (!slug) {
    return "";
  }

  const requestHeaders = await headers();
  // After the proxy rewrites to `/s/<slug>`, `host` is the internal target
  // (`localhost:3000`) and the address the shopper actually asked for survives in
  // `x-forwarded-host`. Reading `host` first would make every storefront look
  // like the path form and keep the prefix in every link.
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "";
  const route = resolveStoreFromHost(host);

  if (route.type === "custom-domain") {
    return "";
  }

  // Guard on the slug as well: if some other tenant's host ever renders this
  // store, the prefixed form is the one that still resolves.
  if (route.type === "storefront" && route.slug === slug) {
    return "";
  }

  return `/s/${slug}`;
}

/**
 * The origin the shopper's browser actually asked for.
 *
 * `request.nextUrl.origin` cannot be used for anything the browser will follow:
 * it is built from the address this server listens on, so behind Caddy it reads
 * `https://localhost:3000`. A redirect to that is a dead end — which is exactly
 * what every cart and checkout POST used to return.
 *
 * Caddy sets `x-forwarded-host` and `x-forwarded-proto`; the plain `Host` header
 * is the fallback for a direct request with no proxy in front.
 */
export function storefrontRequestOrigin(request: NextRequest) {
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const protocol = forwardedProtocol || request.nextUrl.protocol.replace(":", "") || "https";

  return `${protocol}://${host}`;
}
