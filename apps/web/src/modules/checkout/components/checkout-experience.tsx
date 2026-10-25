"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Cart, CartScope } from "../../cart/cart.types";
import type { AppliedBundle } from "../../merchandising/bundle-pricing";
import type { OrderBumpOffer } from "../../merchandising/order-bump.schema";
import type { PaymentMethodTypeValue } from "../../payments/payment.schema";
import type { RedemptionLimits } from "../../loyalty/loyalty.rules";
import { CheckoutForm, type CheckoutLoyaltyOffer } from "./checkout-form";
import type { VerifiedPoints } from "./checkout-points-redemption";

/** The server's answer for this basket: the limits, and the balance they were read from. */
type PointsQuote = RedemptionLimits & { balance: number };
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
  /** The loyalty programme a shopper may opt into, or null when none is running. */
  loyaltyOffer: CheckoutLoyaltyOffer | null;
  /** Priced by the server, or null when the store has no offer standing. */
  orderBump: OrderBumpOffer | null;
  paymentMethods: CheckoutPaymentMethod[];
  phoneOtpRequired: boolean;
  /** Product id to its storefront page, for the summary; a missing id is not linked. */
  productHrefs: Record<string, string>;
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
  loyaltyOffer,
  orderBump,
  paymentMethods,
  phoneOtpRequired,
  productHrefs,
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
  // Points, lifted for the same reason. `pointsChoice` null means "as many as
  // this order allows", so a coupon or a bump changing the cap moves the
  // pre-filled figure with it until the shopper picks their own.
  const [verifiedPoints, setVerifiedPoints] = useState<VerifiedPoints | null>(null);
  const [pointsChoice, setPointsChoice] = useState<number | null>(null);
  // The limits come from the server, never from arithmetic here: the page used
  // to work the cap out itself on a coupon quoted before bundle savings, and
  // so offered a maximum the order measured differently. Now the server prices
  // the page's own basket the way the order will and says what it allows.
  const [pointsQuote, setPointsQuote] = useState<PointsQuote | null>(null);
  const [pointsQuoteMessage, setPointsQuoteMessage] = useState<string | null>(null);
  const [quotingPoints, setQuotingPoints] = useState(false);
  const appliedPoints = pointsQuote
    ? Math.min(Math.max(pointsChoice ?? pointsQuote.maxPoints, 0), pointsQuote.maxPoints)
    : 0;
  const loyaltyRedemption =
    pointsQuote && pointsQuote.available && appliedPoints >= pointsQuote.minPoints
      ? { discount: (appliedPoints * pointsQuote.pointValueCents) / 100, points: appliedPoints }
      : null;
  const onPointsVerified = useCallback((verified: VerifiedPoints) => {
    setVerifiedPoints(verified);
    setPointsChoice(null);
  }, []);
  const onPointsRemoved = useCallback(() => {
    setVerifiedPoints(null);
    setPointsChoice(null);
    setPointsQuote(null);
    setPointsQuoteMessage(null);
  }, []);
  const quotedCouponCode = appliedCoupon?.code ?? "";
  const quotedBumpId = acceptedBump?.productId ?? "";

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

  // Re-quoted whenever something that moves the cap moves: the coupon, the
  // add-on, the delivery option (a free-shipping coupon follows it), or a
  // fresh verification. The order will price the same basket the same way.
  useEffect(() => {
    if (!verifiedPoints) {
      return;
    }

    let cancelled = false;

    setQuotingPoints(true);

    void fetch("/api/checkout/loyalty-quote", {
      body: JSON.stringify({
        checkoutScope,
        couponCode: quotedCouponCode,
        orderBumpProductId: quotedBumpId,
        phone: verifiedPoints.phone,
        shippingRateId: activeShippingId,
        storeSlug,
        submissionId,
        token: verifiedPoints.token
      }),
      headers: { "content-type": "application/json" },
      method: "POST"
    })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as
          | (Partial<PointsQuote> & { error?: string })
          | null;

        if (cancelled) {
          return;
        }

        if (response.ok && body && typeof body.maxPoints === "number") {
          setPointsQuote({
            available: Boolean(body.available),
            balance: Number(body.balance ?? 0),
            maxPoints: body.maxPoints,
            minPoints: Number(body.minPoints ?? 0),
            pointValueCents: Number(body.pointValueCents ?? 0)
          });
          setPointsQuoteMessage(null);
        } else {
          setPointsQuote(null);
          setPointsQuoteMessage(body?.error ?? "We couldn't check your points just now.");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPointsQuote(null);
          setPointsQuoteMessage("We couldn't check your points just now.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQuotingPoints(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeShippingId, checkoutScope, quotedBumpId, quotedCouponCode, storeSlug, submissionId, verifiedPoints]);

  return (
    <section className="sf-checkout-layout" aria-label="Checkout form">
      <CheckoutForm
        checkoutError={checkoutError}
        checkoutScope={checkoutScope}
        couponCode={appliedCoupon?.code ?? ""}
        currency={currency}
        loyaltyOffer={loyaltyOffer}
        notes={cart.note}
        redemption={{
          appliedPoints,
          balance: pointsQuote?.balance ?? verifiedPoints?.balance ?? null,
          limits: pointsQuote,
          onChoose: setPointsChoice,
          onRemove: onPointsRemoved,
          onVerified: onPointsVerified,
          quoteMessage: pointsQuoteMessage,
          quoting: quotingPoints,
          verified: verifiedPoints
        }}
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
        loyaltyRedemption={loyaltyRedemption}
        onApplyCoupon={applyCoupon}
        onRemoveCoupon={() => setAppliedCoupon(null)}
        orderBump={acceptedBump}
        productHrefs={productHrefs}
        shippingAmount={selectedShippingRate?.amount}
        {...(selectedShippingRate?.name ? { shippingLabel: selectedShippingRate.name } : {})}
      />
    </section>
  );
}
