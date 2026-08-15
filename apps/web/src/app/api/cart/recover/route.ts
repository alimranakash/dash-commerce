import { NextResponse, type NextRequest } from "next/server";
import { restoreCartFromSnapshot } from "../../../../modules/cart/cart.service";
import { resolveStoreFromHost } from "../../../../lib/host-routing";
import { resolveCustomDomainRoute } from "../../../../modules/domains/domain-routing";
import { getStorefrontBySlug } from "../../../../modules/storefront/resolver";

/**
 * The link a seller sends to bring an abandoned cart back.
 *
 * The cart itself is an httpOnly cookie scoped to the storefront hostname, so
 * recovery has to happen on the store's own origin: this rebuilds the cookie
 * from the saved snapshot and drops the shopper on their cart. The store is
 * taken from the hostname rather than the query string, so one store's link can
 * never write a cart cookie for another tenant.
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";
  const slug = await resolveStoreSlug(request);

  if (!slug) {
    return NextResponse.redirect(new URL("/", request.nextUrl.origin), 303);
  }

  const store = await getStorefrontBySlug(slug);

  if (!store || !token) {
    return NextResponse.redirect(new URL(`/s/${slug}/cart`, request.nextUrl.origin), 303);
  }

  const cart = await restoreCartFromSnapshot(store.id, token);

  return NextResponse.redirect(
    new URL(`/s/${slug}/cart${cart ? "?recovered=1" : "?cartError=This%20cart%20is%20no%20longer%20available."}`, request.nextUrl.origin),
    303
  );
}

async function resolveStoreSlug(request: NextRequest) {
  const hostRoute = resolveStoreFromHost(
    request.headers.get("host") ?? request.nextUrl.hostname
  );

  if (hostRoute.type === "storefront") {
    return hostRoute.slug;
  }

  if (hostRoute.type === "custom-domain") {
    const route = await resolveCustomDomainRoute(hostRoute.domain);

    return route?.slug ?? null;
  }

  // Any other host (the seller app, the marketing site) can still be used to
  // preview a recovery link, but only with an explicit store slug.
  return request.nextUrl.searchParams.get("store")?.trim() || null;
}
