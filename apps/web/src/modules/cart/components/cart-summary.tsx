import Link from "next/link";
import type { Cart } from "../cart.types";

type CartSummaryProps = {
  cart: Cart;
  currency: string;
  shippingAmount?: unknown;
  shippingLabel?: string;
  storeId: string;
  storeSlug: string;
};

export function CartSummary({
  cart,
  currency,
  shippingAmount,
  shippingLabel,
  storeId,
  storeSlug
}: CartSummaryProps) {
  const isEmpty = cart.items.length === 0;
  const hasShippingEstimate = shippingAmount !== undefined;
  const estimatedTotal = (Number(cart.totals.subtotal) + Number(shippingAmount ?? 0)).toFixed(2);

  return (
    <aside className="sf-cart-summary" aria-labelledby="cart-summary-title">
      <h2 id="cart-summary-title">Order summary</h2>
      <div>
        <span>Items</span>
        <strong>{cart.totals.itemCount}</strong>
      </div>
      <div>
        <span>Subtotal</span>
        <strong>{formatMoney(cart.totals.subtotal, currency)}</strong>
      </div>
      {hasShippingEstimate ? (
        <>
          <div>
            <span>{shippingLabel ?? "Shipping"}</span>
            <strong>{formatMoney(shippingAmount, currency)}</strong>
          </div>
          <div>
            <span>Estimated total</span>
            <strong>{formatMoney(estimatedTotal, currency)}</strong>
          </div>
        </>
      ) : null}
      {isEmpty ? (
        <button disabled type="button">
          Checkout
        </button>
      ) : (
        <Link className="sf-checkout-link" href={`/s/${storeSlug}/checkout`}>
          Checkout
        </Link>
      )}
      <p>Shipping and payment are confirmed securely during checkout.</p>
      {!isEmpty ? (
        <form action="/api/cart" method="post">
          <input name="cartAction" type="hidden" value="clear" />
          <input name="storeId" type="hidden" value={storeId} />
          <input name="storeSlug" type="hidden" value={storeSlug} />
          <button className="sf-text-button" type="submit">
            Clear cart
          </button>
        </form>
      ) : null}
    </aside>
  );
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
