"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { CartScope } from "../../cart/cart.types";
import type { OrderBumpOffer } from "../../merchandising/order-bump.schema";
import type { PaymentMethodTypeValue } from "../../payments/payment.schema";
import { defaultCheckoutSettings } from "../checkout-settings";

const CONTACT_ENDPOINT = "/api/checkout/contact";
const CONTACT_DEBOUNCE_MS = 900;
const CAPTURED_FIELDS = [
  "addressLine1",
  "addressLine2",
  "area",
  "city",
  "country",
  "couponCode",
  "district",
  "email",
  "name",
  "paymentMethod",
  "phone",
  "postalCode",
  "shippingRateId"
] as const;

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

type CheckoutFormProps = {
  checkoutError: string | undefined;
  /** Which basket the POST settles: the cart, or a Direct Checkout of one item. */
  checkoutScope: CartScope;
  /** Owned by `CheckoutExperience`; carried here only so the POST includes it. */
  couponCode: string;
  currency: string;
  notes: string;
  /** The store's standing offer, or null when there is none for this cart. */
  orderBump: OrderBumpOffer | null;
  orderBumpAccepted: boolean;
  paymentMethods: CheckoutPaymentMethod[];
  phoneOtpRequired: boolean;
  selectedShippingId: string;
  shippingRates: CheckoutShippingRate[];
  storeSlug: string;
  /** Identifies this page load, so one submission cannot become two orders. */
  submissionId: string;
  onOrderBumpChange: (accepted: boolean) => void;
  onShippingChange: (shippingRateId: string) => void;
};

export function CheckoutForm({
  checkoutError,
  checkoutScope,
  couponCode,
  currency,
  notes,
  orderBump,
  orderBumpAccepted,
  paymentMethods,
  phoneOtpRequired,
  selectedShippingId,
  shippingRates,
  storeSlug,
  submissionId,
  onOrderBumpChange,
  onShippingChange
}: CheckoutFormProps) {
  const selectedShippingRate = shippingRates.find((rate) => rate.id === selectedShippingId) ?? shippingRates[0];
  const defaultPaymentMethod = paymentMethods[0];
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(defaultPaymentMethod?.type ?? "COD");
  const canSubmit = paymentMethods.length > 0 && shippingRates.length > 0;
  const settings = defaultCheckoutSettings;
  const selectedPayment = paymentMethods.find((method) => method.type === selectedPaymentMethod) ?? defaultPaymentMethod;
  const needsPaymentReference = selectedPayment ? isManualCheckoutPayment(selectedPayment.type) : false;
  // Only cash on delivery, and only where the seller asked for it. A prepaid
  // order has already cost the buyer money, so its number is not what is at risk.
  const needsPhoneCode = phoneOtpRequired && selectedPaymentMethod === "COD";
  const formRef = useRef<HTMLFormElement>(null);
  const [isPlacing, setIsPlacing] = useState(false);

  useCheckoutContactCapture(formRef, storeSlug, checkoutScope);
  useRestoredPageReset(setIsPlacing);

  return (
    <form
      action="/api/checkout"
      className="sf-checkout-form"
      method="post"
      onSubmit={(event) => {
        // The first submission is already on its way by the time this runs; the
        // guard is for the second tap, which arrives while the page is still
        // sitting there waiting for the redirect. The server does not trust it
        // either — the submission key below is what actually decides.
        if (isPlacing) {
          event.preventDefault();
          return;
        }

        setIsPlacing(true);
      }}
      ref={formRef}
    >
      <input name="storeSlug" type="hidden" value={storeSlug} />
      <input name="checkoutScope" type="hidden" value={checkoutScope} />
      <input name="submissionId" type="hidden" value={submissionId} />
      <input name="couponCode" type="hidden" value={couponCode} />
      <input name="country" type="hidden" value="Bangladesh" />
      <input name="city" type="hidden" value={selectedShippingRate?.city ?? ""} />
      <input name="addressLine2" type="hidden" value="" />
      <input name="postalCode" type="hidden" value="" />
      <input name="email" type="hidden" value="" />
      <input name="notes" type="hidden" value={notes} />
      {!needsPaymentReference ? <input name="paymentReference" type="hidden" value="" /> : null}
      <input name="paymentNote" type="hidden" value="" />
      <input name="district" type="hidden" value={selectedShippingRate?.district ?? selectedShippingRate?.name ?? ""} />
      <input name="area" type="hidden" value={selectedShippingRate?.area ?? ""} />
      {checkoutError ? <p className="sf-alert">{checkoutError}</p> : null}
      <div className="sf-checkout-form-heading">
        <p>Secure checkout</p>
        <h1>{settings.title}</h1>
        <span>{settings.description}</span>
      </div>
      <fieldset>
        <legend>Delivery details</legend>
        <CheckoutField
          autoComplete="name"
          name="name"
          setting={settings.fields.fullName}
          type="text"
        />
        <CheckoutField
          autoComplete="tel"
          name="phone"
          setting={settings.fields.mobileNumber}
          type="tel"
        />
        <label className="sf-form-wide">
          {settings.fields.fullAddress.label}
          <textarea
            autoComplete="street-address"
            name="addressLine1"
            placeholder={settings.fields.fullAddress.placeholder}
            required={settings.fields.fullAddress.required}
            rows={4}
          />
        </label>
      </fieldset>
      <fieldset>
        <legend>{settings.fields.deliveryArea.label}</legend>
        {shippingRates.length === 0 ? (
          <p className="sf-alert">This store has not enabled any delivery areas yet.</p>
        ) : (
          <div className="sf-checkout-options">
            {shippingRates.map((rate) => (
              <label className="sf-checkout-option" key={rate.id}>
                <input
                  checked={rate.id === selectedShippingRate?.id}
                  name="shippingRateId"
                  required
                  type="radio"
                  value={rate.id}
                  onChange={() => onShippingChange(rate.id)}
                />
                <span>
                  <strong>{rate.name}</strong>
                  <small>{formatDeliveryArea(rate)}</small>
                </span>
                <b>{formatMoney(rate.amount, currency)}</b>
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <fieldset>
        <legend>Payment</legend>
        {paymentMethods.length === 0 ? (
          <p className="sf-alert">This store has not enabled any payment methods yet.</p>
        ) : (
          <div className="sf-checkout-options">
            {paymentMethods.map((method) => (
              <label className="sf-checkout-option" key={method.type}>
                <input
                  defaultChecked={method.type === defaultPaymentMethod?.type}
                  name="paymentMethod"
                  onChange={() => setSelectedPaymentMethod(method.type)}
                  required
                  type="radio"
                  value={method.type}
                />
                <span>
                  <strong>{method.name}</strong>
                  {method.description ? <small>{method.description}</small> : null}
                  {method.instructions ? <small>{method.instructions}</small> : null}
                </span>
              </label>
            ))}
          </div>
        )}
        {needsPaymentReference ? (
          <label>
            Transaction ID
            <input
              name="paymentReference"
              placeholder="Enter your payment transaction ID"
              required
              type="text"
            />
          </label>
        ) : null}
      </fieldset>
      {needsPhoneCode ? (
        <CheckoutPhoneVerification formRef={formRef} storeSlug={storeSlug} />
      ) : (
        <input name="verificationCode" type="hidden" value="" />
      )}
      {/* Only the id is posted. The discount and the price behind it are read
          again on the server when the order is placed. */}
      <input
        name="orderBumpProductId"
        type="hidden"
        value={orderBump && orderBumpAccepted ? orderBump.productId : ""}
      />
      {orderBump ? (
        <CheckoutOrderBump
          accepted={orderBumpAccepted}
          currency={currency}
          offer={orderBump}
          onChange={onOrderBumpChange}
        />
      ) : null}
      <button disabled={!canSubmit || isPlacing} type="submit">
        {isPlacing ? "Placing order..." : settings.confirmButtonText}
      </button>
    </form>
  );
}

/**
 * The one-tick offer, sitting immediately above Place Order.
 *
 * That position is the whole point: it is the last thing read before the
 * decision is made, and it asks for a yes or a no rather than a trip back to
 * the catalogue. It is a label rather than a button so the tick target covers
 * the whole panel.
 */
function CheckoutOrderBump({
  accepted,
  currency,
  offer,
  onChange
}: {
  accepted: boolean;
  currency: string;
  offer: OrderBumpOffer;
  onChange: (accepted: boolean) => void;
}) {
  return (
    <label className={`sf-checkout-bump ${accepted ? "is-accepted" : ""}`}>
      <input
        checked={accepted}
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
      <span className="sf-checkout-bump-body">
        <strong>{offer.headline}</strong>
        <span className="sf-checkout-bump-product">
          {offer.imageUrl ? <img alt="" loading="lazy" src={offer.imageUrl} /> : null}
          <span>
            <b>{offer.title}</b>
            {offer.description ? <small>{offer.description}</small> : null}
            <span className="sf-checkout-bump-price">
              <b>{formatCheckoutMoney(offer.offerPrice, currency)}</b>
              <s>{formatCheckoutMoney(offer.listPrice, currency)}</s>
              <em>Save {formatCheckoutMoney(offer.savingAmount, currency)}</em>
            </span>
          </span>
        </span>
      </span>
    </label>
  );
}

function formatCheckoutMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value) || 0);
}

/**
 * The cash-on-delivery number check.
 *
 * The code is only typed here; it is checked when the order is created, so
 * nothing on this page can be tampered with to skip the step. The number is
 * read back out of the form rather than mirrored into state, so a shopper who
 * corrects a typo above and asks again gets a code at the number they fixed.
 */
function CheckoutPhoneVerification({
  formRef,
  storeSlug
}: {
  formRef: RefObject<HTMLFormElement | null>;
  storeSlug: string;
}) {
  const [isSending, setIsSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function sendCode() {
    const form = formRef.current;

    if (!form) {
      return;
    }

    const phone = String(new FormData(form).get("phone") ?? "").trim();

    if (!phone) {
      setMessage("Enter your mobile number above first.");
      return;
    }

    setIsSending(true);
    setMessage(null);

    const response = await fetch("/api/checkout/verify-phone", {
      body: JSON.stringify({ phone, storeSlug }),
      headers: { "Content-Type": "application/json" },
      method: "POST"
    });
    const body = (await response.json().catch(() => null)) as
      | { devCode?: string; error?: string; identifier?: string }
      | null;

    if (response.ok && body?.identifier) {
      setSentTo(body.identifier);
      setDevCode(body.devCode ?? null);
      setMessage(null);
    } else {
      setMessage(body?.error ?? "We could not send a code. Check the number and try again.");
    }

    setIsSending(false);
  }

  return (
    <fieldset>
      <legend>Confirm your number</legend>
      <p className="sf-checkout-hint">
        {sentTo
          ? `We sent a 6-digit code by SMS to ${sentTo}. Enter it to place this order.`
          : "Cash on delivery orders from this store are confirmed with a code sent by SMS."}
      </p>
      <button disabled={isSending} onClick={sendCode} type="button">
        {isSending ? "Sending..." : sentTo ? "Send another code" : "Send code"}
      </button>
      {sentTo ? (
        <label>
          Verification code
          <input
            autoComplete="one-time-code"
            inputMode="numeric"
            maxLength={6}
            name="verificationCode"
            placeholder="6-digit code"
            required
            type="text"
          />
        </label>
      ) : (
        <input name="verificationCode" type="hidden" value="" />
      )}
      {devCode ? <p className="sf-checkout-hint">Development build: the code is {devCode}.</p> : null}
      {message ? <p className="sf-alert">{message}</p> : null}
    </fieldset>
  );
}

/**
 * Puts the Place Order button back after a trip through the back button.
 *
 * A page restored from the back/forward cache comes back with the state it had
 * when it was hidden — which, for a page that was just submitted, is a dead
 * button. Resubmitting from a restored page is safe: it carries the same
 * submission key, so it lands on the order that was already placed.
 */
function useRestoredPageReset(setIsPlacing: (value: boolean) => void) {
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setIsPlacing(false);
      }
    };

    window.addEventListener("pageshow", onShow);

    return () => window.removeEventListener("pageshow", onShow);
  }, [setIsPlacing]);
}

/**
 * Saves the checkout form as the shopper types it, and once more if they leave.
 *
 * A shopper who fills the form in and then closes the tab is the single most
 * recoverable kind of lost order, and the form's own submit handler never runs
 * for them — so the fields are sent to a side channel that only updates the
 * cart snapshot. `pagehide` (not `unload`) is what fires reliably on mobile,
 * and sendBeacon survives the page going away.
 *
 * `CAPTURED_FIELDS` is a list rather than the whole form on purpose: the
 * verification code and the payment reference are the two things on this page
 * that can authorise something, and neither belongs in a side channel that
 * exists to be read by the seller later.
 */
function useCheckoutContactCapture(
  formRef: React.RefObject<HTMLFormElement | null>,
  storeSlug: string,
  checkoutScope: CartScope
) {
  const lastSent = useRef("");

  useEffect(() => {
    const form = formRef.current;

    if (!form) {
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    const send = (leaving: boolean) => {
      const data = new FormData(form);
      const read = (key: string) => String(data.get(key) ?? "").trim();

      // Nothing reachable yet — an address alone gives the seller no way to
      // follow up, and a half-typed one is not worth a request either.
      if (!read("phone") && !read("email")) {
        return;
      }

      // Both of these say where the draft goes rather than what is in it, which
      // is why they are here and not in CAPTURED_FIELDS.
      const fields = new URLSearchParams({ checkoutScope, storeSlug });

      for (const field of CAPTURED_FIELDS) {
        fields.set(field, read(field));
      }

      const body = fields.toString();

      if (body === lastSent.current) {
        return;
      }

      lastSent.current = body;

      const payload = new Blob([body], { type: "application/x-www-form-urlencoded" });

      if (leaving && navigator.sendBeacon(CONTACT_ENDPOINT, payload)) {
        return;
      }

      void fetch(CONTACT_ENDPOINT, { body: payload, keepalive: true, method: "POST" }).catch(
        () => undefined
      );
    };

    const onInput = () => {
      if (timer) {
        clearTimeout(timer);
      }

      timer = setTimeout(() => send(false), CONTACT_DEBOUNCE_MS);
    };
    const onLeave = () => send(true);

    form.addEventListener("input", onInput);
    window.addEventListener("pagehide", onLeave);

    return () => {
      if (timer) {
        clearTimeout(timer);
      }

      form.removeEventListener("input", onInput);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [checkoutScope, formRef, storeSlug]);
}

function isManualCheckoutPayment(type: PaymentMethodTypeValue) {
  return type === "BKASH_MANUAL" || type === "NAGAD_MANUAL" || type === "ROCKET_MANUAL";
}

function formatDeliveryArea(rate: CheckoutShippingRate) {
  return [rate.zone.name, rate.area, rate.city, rate.district].filter(Boolean).join(" - ");
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en-BD", {
    currency,
    style: "currency"
  }).format(Number(value));
}

function CheckoutField({
  autoComplete,
  name,
  setting,
  type
}: {
  autoComplete: string;
  name: string;
  setting: {
    label: string;
    placeholder: string;
    required: boolean;
    visible: boolean;
  };
  type: string;
}) {
  if (!setting.visible) {
    return null;
  }

  return (
    <label>
      {setting.label}
      <input
        autoComplete={autoComplete}
        name={name}
        placeholder={setting.placeholder}
        required={setting.required}
        type={type}
      />
    </label>
  );
}
