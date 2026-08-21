import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createCheckoutOrder } from "../../../modules/checkout/checkout.service";
import { sendGa4PurchaseEvent } from "../../../modules/marketing/ga4-mp";
import { sendMetaPurchaseEvent } from "../../../modules/marketing/meta-capi";
import {
  sendCustomOrderSms,
  sendOrderConfirmationSms
} from "../../../modules/orders/order-sms.service";
import type { PaymentMethodTypeValue } from "../../../modules/payments/payment.schema";
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
      shippingRateId: getValue(formData, "shippingRateId"),
      paymentMethod: getValue(formData, "paymentMethod") as PaymentMethodTypeValue,
      paymentReference: getValue(formData, "paymentReference"),
      paymentNote: getValue(formData, "paymentNote"),
      verificationCode: getValue(formData, "verificationCode")
    });

    revalidatePath(`/s/${store.slug}`);
    revalidatePath(`/s/${store.slug}/cart`);
    revalidatePath(`/s/${store.slug}/checkout`);
    revalidatePath("/dashboard/orders");

    const thankYouUrl = new URL(
      `/s/${store.slug}/thank-you/${order.orderNumber}`,
      request.nextUrl.origin
    ).toString();

    // Post-order side effects only: the order is committed and the cart cleared
    // before these run. Every sender resolves rather than rejects, and the extra
    // catch on each guarantees a confirmed order can never be reported to the
    // customer as a checkout failure. Each no-ops unless the seller enabled it,
    // and because the catch is attached per sender, one being misconfigured or
    // slow cannot suppress the others.
    await Promise.all([
      sendMetaPurchaseEvent({
        eventSourceUrl: thankYouUrl,
        orderId: order.id,
        storeId: store.id
      }).catch(() => undefined),
      sendGa4PurchaseEvent({
        // First-party cookie, readable here: it stitches the server event onto
        // the same GA4 user as the browser session that placed the order.
        gaCookie: request.cookies.get("_ga")?.value,
        orderId: order.id,
        pageLocation: thankYouUrl,
        storeId: store.id
      }).catch(() => undefined),
      sendOrderConfirmationSms({
        currency: store.currency,
        orderNumber: order.orderNumber,
        phone: order.customerPhone,
        storeId: store.id,
        storeName: store.name,
        total: Number(order.totalAmount)
      }).catch(() => undefined),
      sendCustomOrderSms({
        currency: store.currency,
        customerName: order.customerName,
        orderNumber: order.orderNumber,
        phone: order.customerPhone,
        storeId: store.id,
        storeName: store.name,
        total: Number(order.totalAmount)
      }).catch(() => undefined)
    ]);

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
