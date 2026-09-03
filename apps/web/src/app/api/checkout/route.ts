import { storefrontBasePath, storefrontRequestOrigin } from "../../../modules/storefront/base-path";
import { NextResponse, type NextRequest } from "next/server";
import { readClientIp } from "../../../lib/request-ip";
import { parseCartScope } from "../../../modules/cart/cart.types";
import { ZodError } from "zod";
import { completeCheckoutOrder } from "../../../modules/checkout/checkout-completion";
import { createCheckoutOrder } from "../../../modules/checkout/checkout.service";
import type { PaymentMethodTypeValue } from "../../../modules/payments/payment.schema";
import { getStorefrontBySlug } from "../../../modules/storefront/resolver";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const storeSlug = getValue(formData, "storeSlug");
  const store = await getStorefrontBySlug(storeSlug);

  if (!store) {
    return await redirectTo(request, storeSlug, `/checkout?checkoutError=Storefront%20not%20found.`);
  }

  try {
    const { order, replayed } = await createCheckoutOrder(store, {
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
      shippingRateId: getValue(formData, "shippingRateId"),
      paymentMethod: getValue(formData, "paymentMethod") as PaymentMethodTypeValue,
      paymentReference: getValue(formData, "paymentReference"),
      paymentNote: getValue(formData, "paymentNote"),
      verificationCode: getValue(formData, "verificationCode"),
      couponCode: getValue(formData, "couponCode"),
      orderBumpProductId: getValue(formData, "orderBumpProductId"),
      submissionId: getValue(formData, "submissionId"),
      // Which basket to settle: the form says so because the checkout page was
      // opened for one of them. Narrowed to a known scope before it reaches a
      // cookie name, and every price is still read from the catalogue.
      checkoutScope: parseCartScope(getValue(formData, "checkoutScope"))
    }, {
      ipAddress: readClientIp(request.headers)
    });

    // The same submission arriving twice: the shopper is sent to the order they
    // already have. Nothing below this line may run again — a second
    // confirmation SMS and a second reported purchase are exactly the damage
    // the submission key exists to prevent, and nothing changed to revalidate.
    if (replayed) {
      return await redirectTo(request, store.slug, `/thank-you/${order.orderNumber}`);
    }

    // Post-order side effects only: the order is committed and the cart cleared
    // before these run. Shared with the AI Shopping Agent, which places an order
    // through the same `createCheckoutOrder` — see `checkout-completion.ts` for
    // why a second copy of this list was not an option.
    await completeCheckoutOrder({
      // First-party cookie, readable here: it stitches the GA4 server event onto
      // the same user as the browser session that placed the order.
      gaCookie: request.cookies.get("_ga")?.value,
      order,
      store
    });

    return await redirectTo(request, store.slug, `/thank-you/${order.orderNumber}`);
  } catch (error) {
    // Back to the checkout the shopper was actually on. Dropping the scope here
    // would answer a failed direct order with the shopper's ordinary cart —
    // a different basket, a different total, and no sign of what went wrong.
    const scope = getValue(formData, "checkoutScope") === "direct" ? "&buy=direct" : "";

    return await redirectTo(
      request,
      store.slug,
      `/checkout?checkoutError=${encodeURIComponent(errorMessage(error))}${scope}`
    );
  }
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

/**
 * Sends the shopper back to the storefront they came from.
 *
 * `path` is relative to the store: the prefix is added here, and the origin
 * comes from the request rather than from `nextUrl`, which behind Caddy points
 * at localhost:3000 — a dead address for the browser being redirected.
 */
async function redirectTo(request: NextRequest, storeSlug: string, path: string) {
  const basePath = await storefrontBasePath(storeSlug);

  return NextResponse.redirect(new URL(`${basePath}${path}`, storefrontRequestOrigin(request)), 303);
}

function errorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Please fix the checkout form.";
  }

  return error instanceof Error ? error.message : "Checkout failed.";
}
