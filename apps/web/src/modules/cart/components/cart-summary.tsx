import Link from "next/link";
import type { StorefrontCartPageSettings } from "../../storefront/customization";
import type { Cart } from "../cart.types";

type CartSummaryProps = {
  cart: Cart;
  checkoutHref: string;
  currency: string;
  settings: StorefrontCartPageSettings;
};

export function CartSummary({ cart, checkoutHref, currency, settings }: CartSummaryProps) {
  const subtotal = Number(cart.totals.subtotal);

  return (
    <section className="general-cart-summary" aria-label="Cart summary">
      {settings.orderNotesEnabled ? (
        <details className="general-cart-notes">
          <summary>Order Notes</summary>
          <textarea aria-label="Order notes" placeholder="Add a note for your order" rows={4} />
        </details>
      ) : null}
      <div className="general-cart-summary-lines">
        <div>
          <span>Subtotal</span>
          <strong>{formatMoney(subtotal, currency)}</strong>
        </div>
        <div>
          <span>Delivery Charges</span>
          <strong>{settings.estimatedDeliveryEnabled ? "Calculated at checkout" : "-"}</strong>
        </div>
        {settings.taxesEnabled ? (
          <div>
            <span>Taxes</span>
            <strong>Calculated at checkout</strong>
          </div>
        ) : null}
        <div className="general-cart-estimated-total">
          <span>Estimated Total</span>
          <strong>{formatMoney(subtotal, currency)}</strong>
        </div>
      </div>
      <Link
        className="general-cart-checkout"
        href={checkoutHref}
        style={{
          backgroundColor: settings.checkoutButtonBackgroundColor,
          borderRadius: `${settings.checkoutButtonBorderRadius}px`,
          color: settings.checkoutButtonTextColor
        }}
      >
        {settings.checkoutButtonText}
      </Link>
    </section>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(value);
}
