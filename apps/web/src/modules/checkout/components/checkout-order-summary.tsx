"use client";

import { useState } from "react";
import type { Cart } from "../../cart/cart.types";

type CheckoutOrderSummaryProps = {
  cart: Cart;
  currency: string;
  shippingAmount?: unknown;
  shippingLabel?: string;
};

export function CheckoutOrderSummary({
  cart,
  currency,
  shippingAmount,
  shippingLabel
}: CheckoutOrderSummaryProps) {
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const subtotal = Number(cart.totals.subtotal);
  const shipping = Number(shippingAmount ?? 0);
  const discount = 0;
  const total = subtotal + shipping - discount;

  function applyCoupon() {
    const code = couponCode.trim();

    if (!code) {
      setCouponMessage("Enter a coupon code to apply.");
      return;
    }

    setCouponMessage("Coupon discounts are not available for this store yet.");
  }

  return (
    <aside className="sf-checkout-summary" aria-labelledby="checkout-summary-title">
      <div className="sf-checkout-summary-panel">
        <div className="sf-checkout-summary-header">
          <p>Order summary</p>
          <h2 id="checkout-summary-title">{formatMoney(total, currency)}</h2>
        </div>
        <div className="sf-checkout-summary-items">
          {cart.items.map((item) => (
            <div className="sf-checkout-summary-item" key={item.lineId}>
              <div className="sf-checkout-summary-image">
                {item.image ? <img alt="" src={item.image} /> : <div aria-hidden="true" />}
                <span>{item.quantity}</span>
              </div>
              <div className="sf-checkout-summary-meta">
                <strong>{item.title}</strong>
                {item.variantTitle ? <small>{item.variantTitle}</small> : null}
                <small>Qty {item.quantity}</small>
              </div>
              <b>{formatMoney(item.lineTotal, currency)}</b>
            </div>
          ))}
        </div>
        <div className="sf-checkout-coupon" aria-label="Coupon code">
          <input
            placeholder="Coupon code"
            type="text"
            value={couponCode}
            onChange={(event) => setCouponCode(event.target.value)}
          />
          <button type="button" onClick={applyCoupon}>
            Apply
          </button>
        </div>
        {couponMessage ? <p className="sf-checkout-coupon-message" aria-live="polite">{couponMessage}</p> : null}
        <div className="sf-checkout-summary-totals">
          <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
          <SummaryRow
            label={shippingLabel ? `Shipping (${shippingLabel})` : "Shipping"}
            value={formatMoney(shipping, currency)}
          />
          <SummaryRow label="Discount" value={formatMoney(discount, currency)} />
          <div className="sf-checkout-summary-row sf-checkout-summary-total">
            <span>Total</span>
            <strong>{formatMoney(total, currency)}</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="sf-checkout-summary-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
