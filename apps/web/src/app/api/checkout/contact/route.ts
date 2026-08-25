import { NextResponse, type NextRequest } from "next/server";
import { readClientIp } from "../../../../lib/request-ip";
import { recordCheckoutDraft } from "../../../../modules/cart/cart.service";
import { getStorefrontBySlug } from "../../../../modules/storefront/resolver";

/**
 * A checkout that has not been submitted, as it currently stands.
 *
 * The checkout form posts here as the shopper fills it in, and once more when
 * the page is hidden, so a customer who never completes the order is still
 * reachable — and still has an address the seller can read back to them — from
 * the incomplete orders list. It is a side channel, not a checkout: it never
 * creates an order and answers 204 regardless.
 *
 * Nothing that could authorise anything is accepted here. The verification code
 * and the payment reference stay on the form and are only ever read by the real
 * checkout, which is the only place they mean anything.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const store = await getStorefrontBySlug(getValue(formData, "storeSlug"));

    if (store) {
      await recordCheckoutDraft(
        store.id,
        {
          addressLine1: getValue(formData, "addressLine1"),
          addressLine2: getValue(formData, "addressLine2"),
          area: getValue(formData, "area"),
          city: getValue(formData, "city"),
          country: getValue(formData, "country"),
          couponCode: getValue(formData, "couponCode"),
          district: getValue(formData, "district"),
          email: getValue(formData, "email"),
          name: getValue(formData, "name"),
          paymentMethod: getValue(formData, "paymentMethod"),
          phone: getValue(formData, "phone"),
          postalCode: getValue(formData, "postalCode"),
          shippingRateId: getValue(formData, "shippingRateId")
        },
        { ipAddress: readClientIp(request.headers) }
      );
    }
  } catch (error) {
    console.error("Failed to record checkout draft", error);
  }

  return new NextResponse(null, { status: 204 });
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
