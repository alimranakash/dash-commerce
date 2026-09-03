import { NextResponse } from "next/server";
import { getQuickViewProduct } from "../../../../modules/quick-view/quick-view.service";

/**
 * One product, for the Quick View modal.
 *
 * The store is named in the query string rather than resolved from the `Host`
 * header for the reason the search-suggest route gives: `proxy.ts` skips `/api`,
 * so this endpoint is reachable on every hostname the platform serves. Both
 * parameters are **slugs**, and everything they can reach is catalogue data a
 * shopper could already open at `/products/<slug>` — no session is involved and
 * no id is accepted.
 *
 * A missing store, a product that is DRAFT, HIDDEN, someone else's, or a shop
 * that has switched Quick View off all produce the same 404. That is not
 * politeness: distinguishing them would turn this into a way to ask whether a
 * given slug exists in a shop that has not published it.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const storeSlug = url.searchParams.get("store")?.trim();
  const productSlug = url.searchParams.get("product")?.trim();

  if (!storeSlug || !productSlug) {
    return NextResponse.json({ message: "Product not found." }, { status: 400 });
  }

  const product = await getQuickViewProduct(storeSlug, productSlug);

  if (!product) {
    return NextResponse.json({ message: "Product not found." }, { status: 404 });
  }

  return NextResponse.json(
    { product },
    {
      headers: {
        // Deliberately short. This payload is a buy box — a price or a stock
        // count going stale here is a shopper told one number and charged
        // another — so it is cached only long enough to absorb the same shopper
        // opening and reopening the same card.
        "Cache-Control": "private, max-age=10"
      }
    }
  );
}
