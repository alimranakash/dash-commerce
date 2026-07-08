"use client";

import { useMemo, useState } from "react";
import type { Cart } from "../../cart/cart.types";
import type { PaymentMethodTypeValue } from "../../payments/payment.schema";
import { CheckoutForm } from "./checkout-form";
import { CheckoutOrderSummary } from "./checkout-order-summary";

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
  shippingRates: CheckoutShippingRate[];
  storeSlug: string;
};

export function CheckoutExperience({
  cart,
  checkoutError,
  currency,
  paymentMethods,
  shippingRates,
  storeSlug
}: CheckoutExperienceProps) {
  const [selectedShippingId, setSelectedShippingId] = useState(shippingRates[0]?.id ?? "");
  const selectedShippingRate = useMemo(
    () => shippingRates.find((rate) => rate.id === selectedShippingId) ?? shippingRates[0],
    [selectedShippingId, shippingRates]
  );

  return (
    <section className="sf-checkout-layout" aria-label="Checkout form">
      <CheckoutForm
        checkoutError={checkoutError}
        currency={currency}
        paymentMethods={paymentMethods}
        selectedShippingId={selectedShippingRate?.id ?? ""}
        shippingRates={shippingRates}
        storeSlug={storeSlug}
        onShippingChange={setSelectedShippingId}
      />
      <CheckoutOrderSummary
        cart={cart}
        currency={currency}
        shippingAmount={selectedShippingRate?.amount}
        {...(selectedShippingRate?.name ? { shippingLabel: selectedShippingRate.name } : {})}
      />
    </section>
  );
}
