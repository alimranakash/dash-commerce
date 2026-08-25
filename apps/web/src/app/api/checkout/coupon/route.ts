import { NextResponse, type NextRequest } from "next/server";
import { getCart } from "../../../../modules/cart/cart.service";
import { evaluateCoupon } from "../../../../modules/coupons/coupon-validation.service";
import { getEnabledShippingRateForCheckout } from "../../../../modules/shipping/shipping.service";
import { getStorefrontBySlug } from "../../../../modules/storefront/resolver";

/**
 * Quotes a coupon against the shopper's current cart.
 *
 * A courtesy, not a decision: nothing here reserves a use or writes anything,
 * and the order transaction evaluates the same code again before charging
 * anyone. That is deliberate — a shopper can sit on this page for an hour, and
 * the coupon can run out or expire in the meantime.
 *
 * The cart is read from the server's own session rather than taken from the
 * request, so the quote cannot be inflated by posting a bigger subtotal.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Invalid request.", ok: false }, { status: 400 });
  }

  const { code, phone, shippingRateId, storeSlug } = body as Record<string, unknown>;
  const store = await getStorefrontBySlug(String(storeSlug ?? ""));

  if (!store) {
    return NextResponse.json({ message: "Storefront not found.", ok: false }, { status: 404 });
  }

  const cart = await getCart(store.id);

  if (cart.items.length === 0) {
    return NextResponse.json({ message: "Your cart is empty.", ok: false });
  }

  // Free shipping is worth whatever the selected rate costs, so the quote needs
  // the same rate the form has selected. An unknown or missing one quotes zero
  // rather than failing: the shopper may not have chosen one yet.
  const shippingAmount = await resolveShippingAmount(store.id, shippingRateId);

  const evaluation = await evaluateCoupon({
    code: String(code ?? ""),
    ...(typeof phone === "string" && phone.trim() ? { customerPhone: phone.trim() } : {}),
    shippingAmount,
    storeId: store.id,
    subtotal: cart.totals.subtotal
  });

  if (!evaluation.ok) {
    return NextResponse.json({ message: evaluation.message, ok: false });
  }

  return NextResponse.json({
    code: evaluation.couponCode,
    discountAmount: evaluation.discountAmount,
    freeShipping: evaluation.freeShipping,
    ok: true
  });
}

async function resolveShippingAmount(storeId: string, shippingRateId: unknown) {
  if (typeof shippingRateId !== "string" || !shippingRateId) {
    return "0.00";
  }

  try {
    const rate = await getEnabledShippingRateForCheckout(storeId, shippingRateId);

    return Number(rate.amount).toFixed(2);
  } catch {
    return "0.00";
  }
}
