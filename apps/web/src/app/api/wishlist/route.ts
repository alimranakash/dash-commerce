import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { storefrontBasePath, storefrontRequestOrigin } from "../../../modules/storefront/base-path";
import { getStorefrontBySlug } from "../../../modules/storefront/resolver";
import {
  wishlistRequestSchema,
  type WishlistRequestInput
} from "../../../modules/wishlist/wishlist.schema";
import {
  addToWishlist,
  clearWishlist,
  removeFromWishlist,
  toggleWishlistItem
} from "../../../modules/wishlist/wishlist.service";
import { EMPTY_WISHLIST_STATE, type WishlistState } from "../../../modules/wishlist/wishlist.types";

/**
 * The wishlist's one mutation path, shaped like `/api/cart` because it is the
 * same problem: a shopper with no session, a cookie that only a route handler
 * may set, and a button that has to keep working without client JS.
 *
 * The tenant comes from the storefront slug rather than from a posted `storeId`.
 * The slug is what visiting the storefront already resolves, so the request
 * cannot name a store the shopper is not looking at, and there is nothing on the
 * other side of a slug that the storefront would not have rendered anyway.
 */
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const storeSlug = getValue(formData, "storeSlug");
  const productSlug = getValue(formData, "productSlug");
  const wantsJson = isAjaxWishlistRequest(request);
  const parsed = wishlistRequestSchema.safeParse({
    ...(formData.has("productId") ? { productId: getValue(formData, "productId") } : {}),
    wishlistAction: getValue(formData, "wishlistAction")
  });

  if (!parsed.success) {
    return fail(request, {
      message: parsed.error.issues[0]?.message ?? "Unsupported wishlist action.",
      productSlug,
      storeSlug,
      wantsJson
    });
  }

  const store = await getStorefrontBySlug(storeSlug);

  if (!store) {
    return fail(request, {
      message: "This store is not available.",
      productSlug,
      storeSlug,
      wantsJson
    });
  }

  const input = parsed.data;

  try {
    const state =
      input.wishlistAction === "clear"
        ? await clearWishlist(store.id)
        : input.wishlistAction === "add"
          ? await addToWishlist(store.id, input.productId)
          : input.wishlistAction === "remove"
            ? await removeFromWishlist(store.id, input.productId)
            : await toggleWishlistItem(store.id, input.productId);

    revalidateStorefrontWishlist(storeSlug);

    if (wantsJson) {
      return NextResponse.json({ ok: true, state });
    }

    return await redirectTo(request, storeSlug, wishlistRedirectPath(input, state));
  } catch (error) {
    return fail(request, {
      message: error instanceof Error ? error.message : "Wishlist update failed.",
      productSlug,
      storeSlug,
      wantsJson
    });
  }
}

/**
 * Where a shopper with no client JS lands, and what the page tells them.
 *
 * A toggle reads its wording off the list it produced rather than off the word
 * "toggle" — the same press is a save or a removal depending on what was there,
 * and telling someone their product was saved as it disappears is the one thing
 * this page must not do.
 */
function wishlistRedirectPath(input: WishlistRequestInput, state: WishlistState) {
  if (input.wishlistAction === "clear") {
    return "/wishlist?cleared=1";
  }

  const saved = state.productIds.includes(input.productId);

  return saved ? "/wishlist?saved=1" : "/wishlist?removed=1";
}

/**
 * A refusal, told the way the caller asked to hear it.
 *
 * The no-JS path lands back on the product it came from when it knows which one,
 * so a shopper who pressed a heart on a sold-out product reads the reason beside
 * that product rather than on an empty wishlist page.
 */
async function fail(
  request: NextRequest,
  input: { message: string; productSlug: string; storeSlug: string; wantsJson: boolean }
) {
  if (input.wantsJson) {
    return NextResponse.json(
      { message: input.message, ok: false, state: EMPTY_WISHLIST_STATE },
      { status: 400 }
    );
  }

  const message = encodeURIComponent(input.message);
  const path = input.productSlug
    ? `/products/${input.productSlug}?wishlistError=${message}`
    : `/wishlist?wishlistError=${message}`;

  return await redirectTo(request, input.storeSlug, path);
}

function isAjaxWishlistRequest(request: NextRequest) {
  return (
    request.headers.get("x-wishlist-request") === "ajax" ||
    request.headers.get("accept")?.includes("application/json") === true
  );
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/** Same reasoning as the cart route: the prefix and origin both come from the request. */
async function redirectTo(request: NextRequest, storeSlug: string, path: string) {
  const basePath = await storefrontBasePath(storeSlug);

  return NextResponse.redirect(
    new URL(`${basePath}${path}`, storefrontRequestOrigin(request)),
    303
  );
}

function revalidateStorefrontWishlist(storeSlug: string) {
  if (!storeSlug) {
    return;
  }

  // The internal path is what Next actually serves; the clean address is a
  // rewrite onto it, so revalidating that would revalidate nothing.
  revalidatePath(`/s/${storeSlug}`, "layout");
}
