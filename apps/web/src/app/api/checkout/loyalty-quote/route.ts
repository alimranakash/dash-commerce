import { NextResponse, type NextRequest } from "next/server";
import { getCart } from "../../../../modules/cart/cart.service";
import { parseCartScope } from "../../../../modules/cart/cart.types";
import { quoteCheckoutDiscounts } from "../../../../modules/checkout/checkout-quote";
import { LoyaltyError } from "../../../../modules/loyalty/loyalty.rules";
import { quoteCheckoutRedemption } from "../../../../modules/loyalty/loyalty.service";
import { getEnabledShippingRateForCheckout } from "../../../../modules/shipping/shipping.service";
import { getStorefrontBySlug } from "../../../../modules/storefront/resolver";

/**
 * The most points this shopper can spend on the order the page is showing.
 *
 * Priced on the server, from the server's own cart, through the same
 * functions the order uses — bundles from the cart, the coupon on the cart
 * less the bundle saving, points on the goods after both — so the maximum the
 * page offers is the maximum the order accepts. A verified token is required:
 * without one this says nothing about anyone's balance.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  if (!body) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const store = await getStorefrontBySlug(String(body.storeSlug ?? ""));

  if (!store) {
    return NextResponse.json({ error: "Storefront not found." }, { status: 404 });
  }

  const scope = parseCartScope(typeof body.checkoutScope === "string" ? body.checkoutScope : null);
  const cart = await getCart(store.id, scope);

  if (cart.items.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 422 });
  }

  const phone = String(body.phone ?? "").trim();

  try {
    const discounts = await quoteCheckoutDiscounts(store.id, {
      cart,
      couponCode: String(body.couponCode ?? "").trim() || undefined,
      customerPhone: phone || undefined,
      orderBumpProductId: String(body.orderBumpProductId ?? "").trim() || undefined,
      shippingAmount: await resolveShippingAmount(store.id, body.shippingRateId)
    });
    const quote = await quoteCheckoutRedemption(store.id, {
      eligibleGoodsCents: discounts.redemptionBaseCents,
      phone,
      submissionId: String(body.submissionId ?? ""),
      token: String(body.token ?? "")
    });

    return NextResponse.json(quote);
  } catch (error) {
    if (error instanceof LoyaltyError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: 422 });
    }

    throw error;
  }
}

/** The selected rate's charge, as the coupon quote reads it; zero when none is chosen yet. */
async function resolveShippingAmount(storeId: string, shippingRateId: unknown) {
  if (typeof shippingRateId !== "string" || !shippingRateId) {
    return "0.00";
  }

  try {
    return Number(
      (await getEnabledShippingRateForCheckout(storeId, shippingRateId)).amount
    ).toFixed(2);
  } catch {
    return "0.00";
  }
}
