import Link from "next/link";

type EmptyCartProps = {
  continueHref: string;
};

export function EmptyCart({ continueHref }: EmptyCartProps) {
  return (
    <div className="general-cart-empty">
      <div className="general-cart-empty-icon" aria-hidden="true">
        <span />
      </div>
      <h2>Your cart is empty</h2>
      <p>Add products to your cart and they will appear here.</p>
      <Link className="general-cart-continue" href={continueHref}>
        Continue Shopping
      </Link>
    </div>
  );
}
