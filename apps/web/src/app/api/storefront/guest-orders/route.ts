import { NextResponse, type NextRequest } from "next/server";
import { forgetGuestOrders } from "../../../../modules/guest-orders/guest-orders.service";
import {
  storefrontBasePath,
  storefrontRequestOrigin
} from "../../../../modules/storefront/base-path";
import { getStorefrontBySlug } from "../../../../modules/storefront/resolver";

/**
 * "Not your device?" — the one mutation the guest order history has.
 *
 * A route handler rather than a server action because a cookie may only be
 * deleted from one, and a plain form POST because the shopper pressing this is
 * on somebody else's phone and must not need client JavaScript to get their
 * name and address off it.
 *
 * The tenant comes from the storefront slug, exactly as `/api/cart` and
 * `/api/wishlist` resolve theirs, and it can only ever delete a cookie this
 * browser is already holding — so an unknown slug is answered with the same
 * redirect rather than an error worth probing.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const storeSlug = String(formData.get("storeSlug") ?? "").trim();
  const store = await getStorefrontBySlug(storeSlug);

  if (store) {
    await forgetGuestOrders(store.id);
  }

  const basePath = await storefrontBasePath(storeSlug);

  return NextResponse.redirect(
    new URL(`${basePath}/account?cleared=1`, storefrontRequestOrigin(request)),
    303
  );
}
