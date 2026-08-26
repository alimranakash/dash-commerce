import { NextResponse, type NextRequest } from "next/server";
import { getCart } from "../../../../modules/cart/cart.service";
import { toCartCrossSellProduct } from "../../../../modules/cart/cart-cross-sell";
import { getCartCrossSellRail, getStorefrontBySlug } from "../../../../modules/storefront/resolver";

/** How many cards the drawer's rail has room for. */
const DRAWER_RAIL_SIZE = 3;

/**
 * Suggestions for whatever is in the cart right now.
 *
 * Fetched by the mini-cart drawer when it opens rather than rendered with the
 * header: the header is a client component three templates deep, and the rail
 * would otherwise have to be threaded through every one of them and paid for on
 * every page view whether or not anyone opens the cart.
 *
 * The cart is read from the request's own cookie, so there is nothing to
 * identify and nothing a caller can ask for on someone else's behalf.
 */
export async function GET(request: NextRequest) {
  const storeSlug = request.nextUrl.searchParams.get("storeSlug") ?? "";
  const store = await getStorefrontBySlug(storeSlug);

  if (!store) {
    return NextResponse.json({ ok: false, products: [] }, { status: 404 });
  }

  const cart = await getCart(store.id);
  const products = await getCartCrossSellRail({
    cartProductIds: cart.items.map((item) => item.productId),
    storeId: store.id,
    take: DRAWER_RAIL_SIZE
  });

  return NextResponse.json({
    ok: true,
    products: products.map(toCartCrossSellProduct)
  });
}
