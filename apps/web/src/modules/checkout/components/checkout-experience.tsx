"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cart, CartScope } from "../../cart/cart.types";
import type { AppliedBundle } from "../../merchandising/bundle-pricing";
import type { OrderBumpOffer } from "../../merchandising/order-bump.schema";
import type { PaymentMethodTypeValue } from "../../payments/payment.schema";
import { CheckoutForm } from "./checkout-form";
import { CheckoutOrderSummary, type AppliedCoupon } from "./checkout-order-summary";

type CheckoutPaymentMethod = {
  type: PaymentMethodTypeValue;
  name: string;
  description: string | null;
  instructions: string | null;
  accountNumber: string | null;
  accountType: string | null;
};

type CheckoutShippingRate = {
  id: string;
  name: string;
  district: string | null;
  city: string | null;
  area: string | null;
  amount: unknown;
  zone: {
    name: string;
  };
};

type CheckoutExperienceProps = {
  /** Priced by the server from the cart, never from anything the browser posts. */
  bundles: AppliedBundle[];
  cart: Cart;
  checkoutError: string | undefined;
  /** Which basket this page is settling; posted with the form and the quote. */
  checkoutScope: CartScope;
  currency: string;
  /** Priced by the server, or null when the store has no offer standing. */
  orderBump: OrderBumpOffer | null;
  paymentMethods: CheckoutPaymentMethod[];
  phoneOtpRequired: boolean;
  shippingRates: CheckoutShippingRate[];
  storeSlug: string;
  /** Identifies this page load, so one submission cannot become two orders. */
  submissionId: string;
};

export function CheckoutExperience({
  bundles,
  cart,
  checkoutError,
  checkoutScope,
  currency,
  orderBump,
  paymentMethods,
  phoneOtpRequired,
  shippingRates,
  storeSlug,
  submissionId
}: CheckoutExperienceProps) {
  const [selectedShippingId, setSelectedShippingId] = useState(shippingRates[0]?.id ?? "");
  // Lifted for the same reason the coupon is: the form has to post the tick and
  // the summary has to price it, and neither of them owns it.
  const [orderBumpAccepted, setOrderBumpAccepted] = useState(false);
  const acceptedBump = orderBump && orderBumpAccepted ? orderBump : null;
  const selectedShippingRate = useMemo(
    () => shippingRates.find((rate) => rate.id === selectedShippingId) ?? shippingRates[0],
    [selectedShippingId, shippingRates]
  );
  // Lifted here rather than kept in the summary: the form has to post the code
  // alongside everything else, and the summary has to price it. Neither owns it.
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const activeShippingId = selectedShippingRate?.id ?? "";

  /** Asks the server what the code is worth. Returns an error message, or null. */
  const quoteCoupon = useCallback(
    async (code: string): Promise<{ coupon?: AppliedCoupon; error?: string }> => {
      try {
        const response = await fetch("/api/checkout/coupon", {
          body: JSON.stringify({ checkoutScope, code, shippingRateId: activeShippingId, storeSlug }),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        const result = (await response.json()) as {
          code?: string;
          discountAmount?: string;
          freeShipping?: boolean;
          message?: string;
          ok?: boolean;
        };

        if (!result.ok) {
          return { error: result.message ?? "That coupon could not be applied." };
        }

        return {
          coupon: {
            code: result.code ?? code.toUpperCase(),
            discountAmount: result.discountAmount ?? "0.00",
            freeShipping: Boolean(result.freeShipping)
          }
        };
      } catch {
        return { error: "Could not check that coupon. Please try again." };
      }
    },
    [activeShippingId, checkoutScope, storeSlug]
  );

  const applyCoupon = useCallback(
    async (code: string) => {
      const { coupon, error } = await quoteCoupon(code);

      if (error) {
        return error;
      }

      setAppliedCoupon(coupon ?? null);

      return null;
    },
    [quoteCoupon]
  );

  // The code alone, not the whole object. This effect sets `appliedCoupon`, so
  // depending on it directly would loop; depending on a string that only changes
  // when the shopper picks a different coupon settles after one pass.
  const freeShippingCode = appliedCoupon?.freeShipping ? appliedCoupon.code : null;

  // A free-shipping coupon is worth exactly the rate that is selected, so
  // switching from Inside to Outside Dhaka changes what it takes off. Re-quoting
  // keeps the figure on screen the one the order will actually be charged.
  useEffect(() => {
    if (!freeShippingCode) {
      return;
    }

    let cancelled = false;

    void quoteCoupon(freeShippingCode).then(({ coupon, error }) => {
      if (cancelled) {
        return;
      }

      // A rate change can push the cart outside the coupon's bounds; dropping it
      // is better than showing a discount that checkout will refuse.
      setAppliedCoupon(error ? null : (coupon ?? null));
    });

    return () => {
      cancelled = true;
    };
  }, [freeShippingCode, quoteCoupon]);

  return (
    <section className="sf-checkout-layout" aria-label="Checkout form">
      <CheckoutForm
        checkoutError={checkoutError}
        checkoutScope={checkoutScope}
        couponCode={appliedCoupon?.code ?? ""}
        currency={currency}
        notes={cart.note}
        orderBump={orderBump}
        orderBumpAccepted={orderBumpAccepted}
        paymentMethods={paymentMethods}
        phoneOtpRequired={phoneOtpRequired}
        selectedShippingId={selectedShippingRate?.id ?? ""}
        shippingRates={shippingRates}
        storeSlug={storeSlug}
        submissionId={submissionId}
        onOrderBumpChange={setOrderBumpAccepted}
        onShippingChange={setSelectedShippingId}
      />
      <CheckoutOrderSummary
        appliedCoupon={appliedCoupon}
        bundles={bundles}
        cart={cart}
        currency={currency}
        onApplyCoupon={applyCoupon}
        onRemoveCoupon={() => setAppliedCoupon(null)}
        orderBump={acceptedBump}
        shippingAmount={selectedShippingRate?.amount}
        {...(selectedShippingRate?.name ? { shippingLabel: selectedShippingRate.name } : {})}
      />
    </section>
  );
}
