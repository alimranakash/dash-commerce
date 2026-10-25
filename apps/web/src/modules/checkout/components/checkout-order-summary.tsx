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
  /**
   * The points the shopper is spending and what they take off, worked out by
   * `redemptionLimits` from the store's own rules. A preview: the order prices
   * the same points again inside its transaction.
   */
  loyaltyRedemption: { discount: number; points: number } | null;
  onApplyCoupon: (code: string) => Promise<string | null>;
  onRemoveCoupon: () => void;
  /** Only ever the accepted offer; an unticked one is not part of the order. */
  orderBump: OrderBumpOffer | null;
  /** Product id to its storefront page; a line whose id is missing is not linked. */
  productHrefs: Record<string, string>;
  shippingAmount?: unknown;
  shippingLabel?: string;
};

export function CheckoutOrderSummary({
  appliedCoupon,
  bundles,
  cart,
  currency,
  loyaltyRedemption,
  onApplyCoupon,
  onRemoveCoupon,
  orderBump,
  productHrefs,
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
  // Applied after the coupon, off the goods only, exactly as the order is.
  const pointsDiscount = loyaltyRedemption?.discount ?? 0;
  // Never below zero on screen, even if a stale quote briefly outruns the cart.
  const total = Math.max(0, subtotal + shipping - discount - bundleSavings - pointsDiscount);
  const itemCount = cart.totals.itemCount + (orderBump ? 1 : 0);

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
          <p>
            Order summary · {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>
          <h2 id="checkout-summary-title">{formatMoney(total, currency)}</h2>
        </div>
        <div className="sf-checkout-summary-items">
          {cart.items.map((item) => (
            <SummaryItem
              currency={currency}
              detail={item.variantTitle}
              href={productHrefs[item.productId]}
              image={item.image}
              key={item.lineId}
              lineTotal={item.lineTotal}
              quantity={item.quantity}
              title={item.title}
              unitPrice={item.price}
            />
          ))}
          {orderBump ? (
            <SummaryItem
              currency={currency}
              detail="Added offer"
              href={productHrefs[orderBump.productId]}
              image={orderBump.imageUrl}
              key="order-bump"
              lineTotal={orderBump.offerPrice}
              quantity={1}
              title={orderBump.title}
              unitPrice={orderBump.offerPrice}
            />
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
          {loyaltyRedemption && pointsDiscount > 0 ? (
            <SummaryRow
              label={`Points (${loyaltyRedemption.points.toLocaleString("en")})`}
              value={`−${formatMoney(pointsDiscount, currency)}`}
            />
          ) : null}
          <div className="sf-checkout-summary-row sf-checkout-summary-total">
            <span>Total</span>
            <strong>{formatMoney(total, currency)}</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * One line of the order. The name and the picture open the product in a new tab:
 * nothing the shopper has typed into the checkout form is kept if they leave the
 * page, so a second look at a product must not cost them the form.
 */
function SummaryItem({
  currency,
  detail,
  href,
  image,
  lineTotal,
  quantity,
  title,
  unitPrice
}: {
  currency: string;
  /** The chosen variant, or what kind of line this is. */
  detail?: string | null | undefined;
  href: string | undefined;
  image: string | null;
  lineTotal: unknown;
  quantity: number;
  title: string;
  unitPrice: unknown;
}) {
  const thumbnail = image ? <img alt="" src={image} /> : <div aria-hidden="true" />;

  return (
    <div className="sf-checkout-summary-item">
      <div className="sf-checkout-summary-image">
        {href ? (
          // The name beside it is the same link, so this one stays out of the
          // tab order and out of a screen reader's list of links.
          <a aria-hidden="true" href={href} rel="noopener" tabIndex={-1} target="_blank">
            {thumbnail}
          </a>
        ) : (
          thumbnail
        )}
        <span>{quantity}</span>
      </div>
      <div className="sf-checkout-summary-meta">
        {/* Clamped at two lines; the full name is always the tooltip. */}
        <strong title={title}>
          {href ? (
            <a href={href} rel="noopener" target="_blank">
              {title}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            title
          )}
        </strong>
        {detail ? <small>{detail}</small> : null}
        <small>
          {quantity > 1
            ? `Qty ${quantity} × ${formatMoney(unitPrice, currency)}`
            : `Qty ${quantity}`}
        </small>
      </div>
      <b>{formatMoney(lineTotal, currency)}</b>
    </div>
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
