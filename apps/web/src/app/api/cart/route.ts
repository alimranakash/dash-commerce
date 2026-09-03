import { storefrontBasePath, storefrontRequestOrigin } from "../../../modules/storefront/base-path";
import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { parseCartItemSource } from "../../../modules/cart/cart.types";
import {
  addToCart,
  clearCart,
  removeCartItem,
  setCartNote,
  startDirectCheckout,
  updateCartItemQuantity
} from "../../../modules/cart/cart.service";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const cartAction = getValue(formData, "cartAction");
  const storeId = getValue(formData, "storeId");
  const storeSlug = getValue(formData, "storeSlug");
  const productId = getValue(formData, "productId");
  const lineId = getValue(formData, "lineId") || productId;
  const productSlug = getValue(formData, "productSlug");
  const variantId = getValue(formData, "variantId");
  const wantsJson = isAjaxCartRequest(request);

  try {
    if (cartAction === "add") {
      await addToCart(
        storeId,
        productId,
        Number(getValue(formData, "quantity") || 1),
        variantId || null,
        // Anything unrecognised reads as an ordinary add rather than being
        // rejected: a mislabelled line is a reporting nit, a failed add is lost
        // revenue.
        parseCartItemSource(getValue(formData, "source"))
      );
      revalidateStorefrontCart(storeSlug);

      if (wantsJson) {
        return NextResponse.json({ ok: true });
      }

      return await redirectTo(request, storeSlug, `/cart?added=1`);
    }

    // Direct Checkout. Nothing about the shopper's own cart changes here — the
    // line goes into a basket of its own — so no revalidation and no cart
    // event: the header still counts what it counted a moment ago, because that
    // is still what is in the cart.
    if (cartAction === "direct") {
      await startDirectCheckout(
        storeId,
        productId,
        Number(getValue(formData, "quantity") || 1),
        variantId || null
      );

      if (wantsJson) {
        return NextResponse.json({ ok: true });
      }

      return await redirectTo(request, storeSlug, `/checkout?buy=direct`);
    }

    if (cartAction === "update") {
      await updateCartItemQuantity(storeId, lineId, Number(getValue(formData, "quantity") || 1));
      revalidateStorefrontCart(storeSlug);

      if (wantsJson) {
        return NextResponse.json({ ok: true });
      }

      return await redirectTo(request, storeSlug, `/cart?updated=1`);
    }

    if (cartAction === "remove") {
      await removeCartItem(storeId, lineId);
      revalidateStorefrontCart(storeSlug);

      if (wantsJson) {
        return NextResponse.json({ ok: true });
      }

      return await redirectTo(request, storeSlug, `/cart?removed=1`);
    }

    if (cartAction === "note") {
      await setCartNote(storeId, String(formData.get("note") ?? ""));
      revalidateStorefrontCart(storeSlug);

      if (wantsJson) {
        return NextResponse.json({ ok: true });
      }

      return await redirectTo(request, storeSlug, `/cart?updated=1`);
    }

    if (cartAction === "clear") {
      await clearCart(storeId);
      revalidateStorefrontCart(storeSlug);

      if (wantsJson) {
        return NextResponse.json({ ok: true });
      }

      return await redirectTo(request, storeSlug, `/cart?cleared=1`);
    }

    throw new Error("Unsupported cart action.");
  } catch (error) {
    const message = encodeURIComponent(
      error instanceof Error ? error.message : "Cart operation failed."
    );
    const readableMessage = error instanceof Error ? error.message : "Cart operation failed.";

    if (wantsJson) {
      return NextResponse.json({ message: readableMessage, ok: false }, { status: 400 });
    }

    // Both of these were asked for from a product page, and that is where the
    // shopper can act on "not enough stock" — the cart page would be showing
    // them a basket the failed line never reached.
    if ((cartAction === "add" || cartAction === "direct") && productSlug) {
      return await redirectTo(request, storeSlug, `/products/${productSlug}?cartError=${message}`);
    }

    return await redirectTo(request, storeSlug, `/cart?cartError=${message}`);
  }
}

function isAjaxCartRequest(request: NextRequest) {
  return request.headers.get("x-cart-request") === "ajax" ||
    request.headers.get("accept")?.includes("application/json") === true;
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Sends the shopper back to the storefront they came from.
 *
 * `path` is relative to the store, not to the app: the prefix is added here so
 * a subdomain gets /cart and the path form gets /s/<slug>/cart, and the origin
 * comes from the request rather than from `nextUrl`, which behind Caddy points
 * at localhost:3000.
 */
async function redirectTo(request: NextRequest, storeSlug: string, path: string) {
  const basePath = await storefrontBasePath(storeSlug);

  return NextResponse.redirect(new URL(`${basePath}${path}`, storefrontRequestOrigin(request)), 303);
}

function revalidateStorefrontCart(storeSlug: string) {
  // These stay on the internal route: /s/<slug> is what Next actually serves,
  // and the prefix-free address is a rewrite onto it. Revalidating the clean
  // path would silently revalidate nothing.
  revalidatePath(`/s/${storeSlug}`);
  revalidatePath(`/s/${storeSlug}/cart`);
  revalidatePath(`/s/${storeSlug}/products`);
}
