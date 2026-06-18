import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import {
  addToCart,
  clearCart,
  removeCartItem,
  updateCartItemQuantity
} from "../../../modules/cart/cart.service";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const cartAction = getValue(formData, "cartAction");
  const storeId = getValue(formData, "storeId");
  const storeSlug = getValue(formData, "storeSlug");
  const productId = getValue(formData, "productId");
  const productSlug = getValue(formData, "productSlug");

  try {
    if (cartAction === "add") {
      await addToCart(storeId, productId, Number(getValue(formData, "quantity") || 1));
      revalidateStorefrontCart(storeSlug);

      return redirectTo(request, `/s/${storeSlug}/cart?added=1`);
    }

    if (cartAction === "update") {
      await updateCartItemQuantity(storeId, productId, Number(getValue(formData, "quantity") || 1));
      revalidateStorefrontCart(storeSlug);

      return redirectTo(request, `/s/${storeSlug}/cart?updated=1`);
    }

    if (cartAction === "remove") {
      await removeCartItem(storeId, productId);
      revalidateStorefrontCart(storeSlug);

      return redirectTo(request, `/s/${storeSlug}/cart?removed=1`);
    }

    if (cartAction === "clear") {
      await clearCart(storeId);
      revalidateStorefrontCart(storeSlug);

      return redirectTo(request, `/s/${storeSlug}/cart?cleared=1`);
    }

    throw new Error("Unsupported cart action.");
  } catch (error) {
    const message = encodeURIComponent(
      error instanceof Error ? error.message : "Cart operation failed."
    );

    if (cartAction === "add" && productSlug) {
      return redirectTo(request, `/s/${storeSlug}/products/${productSlug}?cartError=${message}`);
    }

    return redirectTo(request, `/s/${storeSlug}/cart?cartError=${message}`);
  }
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
}

function revalidateStorefrontCart(storeSlug: string) {
  revalidatePath(`/s/${storeSlug}`);
  revalidatePath(`/s/${storeSlug}/cart`);
  revalidatePath(`/s/${storeSlug}/products`);
}
