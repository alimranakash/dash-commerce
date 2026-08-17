import { NextResponse, type NextRequest } from "next/server";
import { recordCheckoutContact } from "../../../../modules/cart/cart.service";
import { getStorefrontBySlug } from "../../../../modules/storefront/resolver";

/**
 * Contact details from a checkout that has not been submitted.
 *
 * The checkout form posts here as the shopper fills it in, and once more when
 * the page is hidden, so a customer who never completes the order is still
 * reachable from the abandoned cart list. It is a side channel, not a
 * checkout: it never creates an order and answers 204 regardless.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const store = await getStorefrontBySlug(getValue(formData, "storeSlug"));

    if (store) {
      await recordCheckoutContact(store.id, {
        email: getValue(formData, "email"),
        name: getValue(formData, "name"),
        phone: getValue(formData, "phone")
      });
    }
  } catch (error) {
    console.error("Failed to record checkout contact", error);
  }

  return new NextResponse(null, { status: 204 });
}

function getValue(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}
