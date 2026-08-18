import { NextResponse } from "next/server";
import { findSearchableStoreBySlug } from "../../../../../modules/search/search.repository";
import { getStorefrontSearchSuggestions } from "../../../../../modules/search/search.service";

const EMPTY_SUGGESTIONS = {
  categories: [],
  products: [],
  totalProducts: 0
};

/**
 * Suggestions for the storefront header dropdown.
 *
 * The store is named in the query string rather than resolved from the Host
 * header because this endpoint is reachable on every hostname the platform
 * serves — the proxy's matcher skips `/api`. Everything returned is already
 * public catalogue data, so no session is involved.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const slug = url.searchParams.get("store")?.trim();
  const query = url.searchParams.get("q")?.trim();

  if (!slug || !query) {
    return NextResponse.json(EMPTY_SUGGESTIONS);
  }

  const store = await findSearchableStoreBySlug(slug);

  if (!store) {
    return NextResponse.json(EMPTY_SUGGESTIONS, { status: 404 });
  }

  const suggestions = await getStorefrontSearchSuggestions(store.id, { query });

  return NextResponse.json(
    { ...suggestions, currency: store.currency },
    {
      headers: {
        // Short enough that a price or stock edit shows up promptly, long
        // enough to absorb the repeat keystrokes of one shopper typing.
        "Cache-Control": "public, max-age=15, stale-while-revalidate=30"
      }
    }
  );
}
