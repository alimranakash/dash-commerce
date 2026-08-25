"use client";

import { useState } from "react";
import type { Cart } from "../../cart/cart.types";

export type AppliedCoupon = {
  code: string;
  discountAmount: string;
  freeShipping: boolean;
};

type CheckoutOrderSummaryProps = {
  appliedCoupon: AppliedCoupon | null;
  cart: Cart;
  currency: string;
  onApplyCoupon: (code: string) => Promise<string | null>;
  onRemoveCoupon: () => void;
  shippingAmount?: unknown;
  shippingLabel?: string;
};

export function CheckoutOrderSummary({
  appliedCoupon,
  cart,
  currency,
  onApplyCoupon,
  onRemoveCoupon,
  shippingAmount,
  shippingLabel
}: CheckoutOrderSummaryProps) {
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const subtotal = Number(cart.totals.subtotal);
  const shipping = Number(shippingAmount ?? 0);
  const discount = Number(appliedCoupon?.discountAmount ?? 0);
  // Never below zero on screen, even if a stale quote briefly outruns the cart.
  const total = Math.max(0, subtotal + shipping - discount);

  async function applyCoupon() {
    const code = couponCode.trim();

    if (!code) {
      setCouponMessage("Enter a coupon code to apply.");
      return;
    }

    setApplying(true);
    setCouponMessage(null);

    const error = await onApplyCoupon(code);

    setApplying(false);

    if (error) {
      setCouponMessage(error);
      return;
    }

    setCouponCode("");
  }

  function removeCoupon() {
    setCouponMessage(null);
    onRemoveCoupon();
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
        {appliedCoupon ? (
          <div className="sf-checkout-coupon" aria-label="Applied coupon">
            <input readOnly value={appliedCoupon.code} />
            <button onClick={removeCoupon} type="button">
              Remove
            </button>
          </div>
        ) : (
          <div className="sf-checkout-coupon" aria-label="Coupon code">
            <input
              disabled={applying}
              onChange={(event) => setCouponCode(event.target.value)}
              onKeyDown={(event) => {
                // The summary sits outside the checkout form, but Enter in a
                // text box still reads as "submit" to most people.
                if (event.key === "Enter") {
                  event.preventDefault();
                  void applyCoupon();
                }
              }}
              placeholder="Coupon code"
              type="text"
              value={couponCode}
            />
            <button disabled={applying} onClick={() => void applyCoupon()} type="button">
              {applying ? "Checking…" : "Apply"}
            </button>
          </div>
        )}
        {couponMessage ? (
          <p className="sf-checkout-coupon-message" aria-live="polite">
            {couponMessage}
          </p>
        ) : null}
        <div className="sf-checkout-summary-totals">
          <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
          <SummaryRow
            label={shippingLabel ? `Shipping (${shippingLabel})` : "Shipping"}
            value={formatMoney(shipping, currency)}
          />
          <SummaryRow
            label={appliedCoupon ? `Discount (${appliedCoupon.code})` : "Discount"}
            value={discount > 0 ? `−${formatMoney(discount, currency)}` : formatMoney(0, currency)}
          />
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
