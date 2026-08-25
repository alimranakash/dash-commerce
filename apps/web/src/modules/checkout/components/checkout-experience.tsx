"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cart } from "../../cart/cart.types";
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
  cart: Cart;
  checkoutError: string | undefined;
  currency: string;
  paymentMethods: CheckoutPaymentMethod[];
  phoneOtpRequired: boolean;
  shippingRates: CheckoutShippingRate[];
  storeSlug: string;
};

export function CheckoutExperience({
  cart,
  checkoutError,
  currency,
  paymentMethods,
  phoneOtpRequired,
  shippingRates,
  storeSlug
}: CheckoutExperienceProps) {
  const [selectedShippingId, setSelectedShippingId] = useState(shippingRates[0]?.id ?? "");
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
          body: JSON.stringify({ code, shippingRateId: activeShippingId, storeSlug }),
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
    [activeShippingId, storeSlug]
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
        couponCode={appliedCoupon?.code ?? ""}
        currency={currency}
        notes={cart.note}
        paymentMethods={paymentMethods}
        phoneOtpRequired={phoneOtpRequired}
        selectedShippingId={selectedShippingRate?.id ?? ""}
        shippingRates={shippingRates}
        storeSlug={storeSlug}
        onShippingChange={setSelectedShippingId}
      />
      <CheckoutOrderSummary
        appliedCoupon={appliedCoupon}
        cart={cart}
        currency={currency}
        onApplyCoupon={applyCoupon}
        onRemoveCoupon={() => setAppliedCoupon(null)}
        shippingAmount={selectedShippingRate?.amount}
        {...(selectedShippingRate?.name ? { shippingLabel: selectedShippingRate.name } : {})}
      />
    </section>
  );
}
