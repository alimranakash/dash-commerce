import Link from "next/link";
import type { Cart } from "../cart.types";

type CartSummaryProps = {
  cart: Cart;
  currency: string;
  storeId: string;
  storeSlug: string;
};

export function CartSummary({ cart, currency, storeId, storeSlug }: CartSummaryProps) {
  const isEmpty = cart.items.length === 0;

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
      {isEmpty ? (
        <button disabled type="button">
          Checkout
        </button>
      ) : (
        <Link className="sf-checkout-link" href={`/s/${storeSlug}/checkout`}>
          Checkout
        </Link>
      )}
      <p>Checkout, shipping, taxes, and payments will be added in the next platform phase.</p>
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

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
