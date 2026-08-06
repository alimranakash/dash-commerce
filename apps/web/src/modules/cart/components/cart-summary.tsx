import Link from "next/link";
import { formatStorefrontMoney } from "../../storefront/format";
import type { StorefrontCartPageSettings } from "../../storefront/customization";
import type { Cart } from "../cart.types";
import { CartNoteField } from "./cart-note-field";

type CartSummaryProps = {
  cart: Cart;
  checkoutHref: string;
  currency: string;
  settings: StorefrontCartPageSettings;
  storeSlug: string;
};

export function CartSummary({ cart, checkoutHref, currency, settings, storeSlug }: CartSummaryProps) {
  const subtotal = Number(cart.totals.subtotal);

  return (
    <section className="general-cart-summary" aria-label="Cart summary">
      {settings.orderNotesEnabled ? (
        <CartNoteField
          className="general-cart-notes"
          note={cart.note}
          rows={4}
          storeId={cart.storeId}
          storeSlug={storeSlug}
        />
      ) : null}
      <div className="general-cart-summary-lines">
        <div>
          <span>Subtotal</span>
          <strong>{formatStorefrontMoney(subtotal, currency)}</strong>
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
          <strong>{formatStorefrontMoney(subtotal, currency)}</strong>
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
