"use client";

import { useState } from "react";
import type { PaymentMethodTypeValue } from "../../payments/payment.schema";
import { defaultCheckoutSettings } from "../checkout-settings";

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
  currency: string;
  notes: string;
  paymentMethods: CheckoutPaymentMethod[];
  selectedShippingId: string;
  shippingRates: CheckoutShippingRate[];
  storeSlug: string;
  onShippingChange: (shippingRateId: string) => void;
};

export function CheckoutForm({
  checkoutError,
  currency,
  notes,
  paymentMethods,
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

  return (
    <form action="/api/checkout" className="sf-checkout-form" method="post">
      <input name="storeSlug" type="hidden" value={storeSlug} />
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
      <button disabled={!canSubmit} type="submit">
        {settings.confirmButtonText}
      </button>
    </form>
  );
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
