import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createCheckoutOrder } from "../../../modules/checkout/checkout.service";
import { getStorefrontBySlug } from "../../../modules/storefront/resolver";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const storeSlug = getValue(formData, "storeSlug");
  const store = await getStorefrontBySlug(storeSlug);

  if (!store) {
    return redirectTo(request, `/s/${storeSlug}/checkout?checkoutError=Storefront%20not%20found.`);
  }

  try {
    const order = await createCheckoutOrder(store, {
      name: getValue(formData, "name"),
      phone: getValue(formData, "phone"),
      email: getValue(formData, "email"),
      country: getValue(formData, "country") || "Bangladesh",
      district: getValue(formData, "district"),
      city: getValue(formData, "city"),
      area: getValue(formData, "area"),
      addressLine1: getValue(formData, "addressLine1"),
      addressLine2: getValue(formData, "addressLine2"),
      postalCode: getValue(formData, "postalCode"),
      notes: getValue(formData, "notes"),
      paymentMethod: "COD"
    });

    revalidatePath(`/s/${store.slug}`);
    revalidatePath(`/s/${store.slug}/cart`);
    revalidatePath(`/s/${store.slug}/checkout`);
    revalidatePath("/dashboard/orders");

    return redirectTo(request, `/s/${store.slug}/thank-you/${order.orderNumber}`);
  } catch (error) {
    return redirectTo(
      request,
      `/s/${store.slug}/checkout?checkoutError=${encodeURIComponent(errorMessage(error))}`
    );
  }
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function redirectTo(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.nextUrl.origin), 303);
}

function errorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Please fix the checkout form.";
  }

  return error instanceof Error ? error.message : "Checkout failed.";
}
