"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { PaymentMethodTypeValue } from "../../payments/payment.schema";
import { defaultCheckoutSettings } from "../checkout-settings";

const CONTACT_ENDPOINT = "/api/checkout/contact";
const CONTACT_DEBOUNCE_MS = 900;

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
  /** Owned by `CheckoutExperience`; carried here only so the POST includes it. */
  couponCode: string;
  currency: string;
  notes: string;
  paymentMethods: CheckoutPaymentMethod[];
  phoneOtpRequired: boolean;
  selectedShippingId: string;
  shippingRates: CheckoutShippingRate[];
  storeSlug: string;
  onShippingChange: (shippingRateId: string) => void;
};

export function CheckoutForm({
  checkoutError,
  couponCode,
  currency,
  notes,
  paymentMethods,
  phoneOtpRequired,
  selectedShippingId,
  shippingRates,
  storeSlug,
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

  useCheckoutContactCapture(formRef, storeSlug);

  return (
    <form action="/api/checkout" className="sf-checkout-form" method="post" ref={formRef}>
      <input name="storeSlug" type="hidden" value={storeSlug} />
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
      <button disabled={!canSubmit} type="submit">
        {settings.confirmButtonText}
      </button>
    </form>
  );
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
 * Saves the shopper's contact details as they type, and once more if they leave.
 *
 * A shopper who fills in their details and then closes the tab is the single
 * most recoverable kind of abandoned cart, and the form's own submit handler
 * never runs for them — so the details are sent to a side channel that only
 * updates the cart snapshot. `pagehide` (not `unload`) is what fires reliably
 * on mobile, and sendBeacon survives the page going away.
 */
function useCheckoutContactCapture(
  formRef: React.RefObject<HTMLFormElement | null>,
  storeSlug: string
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
      const phone = read("phone");
      const email = read("email");

      // Nothing reachable yet — a name alone gives the seller no way to follow up.
      if (!phone && !email) {
        return;
      }

      const body = new URLSearchParams({ email, name: read("name"), phone, storeSlug }).toString();

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
  }, [formRef, storeSlug]);
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
