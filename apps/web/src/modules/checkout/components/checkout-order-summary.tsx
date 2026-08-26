"use client";

import { useState } from "react";
import type { Cart } from "../../cart/cart.types";
import type { AppliedBundle } from "../../merchandising/bundle-pricing";
import type { OrderBumpOffer } from "../../merchandising/order-bump.schema";

export type AppliedCoupon = {
  code: string;
  discountAmount: string;
  freeShipping: boolean;
};

type CheckoutOrderSummaryProps = {
  appliedCoupon: AppliedCoupon | null;
  bundles: AppliedBundle[];
  cart: Cart;
  currency: string;
  onApplyCoupon: (code: string) => Promise<string | null>;
  onRemoveCoupon: () => void;
  /** Only ever the accepted offer; an unticked one is not part of the order. */
  orderBump: OrderBumpOffer | null;
  shippingAmount?: unknown;
  shippingLabel?: string;
};

export function CheckoutOrderSummary({
  appliedCoupon,
  bundles,
  cart,
  currency,
  onApplyCoupon,
  onRemoveCoupon,
  orderBump,
  shippingAmount,
  shippingLabel
}: CheckoutOrderSummaryProps) {
  const [couponCode, setCouponCode] = useState("");
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const subtotal = Number(cart.totals.subtotal) + Number(orderBump?.offerPrice ?? 0);
  const shipping = Number(shippingAmount ?? 0);
  // The coupon is quoted against the cart alone, and checkout claims it against
  // the cart alone, so the bump never moves this figure in either place.
  const discount = Number(appliedCoupon?.discountAmount ?? 0);
  const bundleSavings = bundles.reduce((total, bundle) => total + Number(bundle.discountAmount), 0);
  // Never below zero on screen, even if a stale quote briefly outruns the cart.
  const total = Math.max(0, subtotal + shipping - discount - bundleSavings);

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
          {orderBump ? (
            <div className="sf-checkout-summary-item" key="order-bump">
              <div className="sf-checkout-summary-image">
                {orderBump.imageUrl ? <img alt="" src={orderBump.imageUrl} /> : <div aria-hidden="true" />}
                <span>1</span>
              </div>
              <div className="sf-checkout-summary-meta">
                <strong>{orderBump.title}</strong>
                <small>Added offer</small>
              </div>
              <b>{formatMoney(orderBump.offerPrice, currency)}</b>
            </div>
          ) : null}
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
          {bundles.map((bundle) => (
            <SummaryRow
              key={bundle.bundleId}
              label={bundle.name}
              value={`−${formatMoney(bundle.discountAmount, currency)}`}
            />
          ))}
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
