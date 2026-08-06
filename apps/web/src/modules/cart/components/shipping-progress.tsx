import Link from "next/link";
import { formatStorefrontMoney } from "../../storefront/format";

type ShippingProgressProps = {
  amount: number;
  currency: string;
  ctaHref: string;
  ctaText: string;
  subtotal: string;
  text: string;
};

export function ShippingProgress({
  amount,
  currency,
  ctaHref,
  ctaText,
  subtotal,
  text
}: ShippingProgressProps) {
  const subtotalValue = Number(subtotal);
  const remaining = Math.max(0, amount - subtotalValue);
  const progress = amount > 0 ? Math.min(100, (subtotalValue / amount) * 100) : 100;
  const message = remaining <= 0
    ? "You qualify for free shipping."
    : text.replace("{amount}", formatStorefrontMoney(remaining, currency));

  return (
    <div className="general-cart-shipping">
      <div className="general-cart-shipping-row">
        <p>{message}</p>
        <Link href={ctaHref}>{ctaText}</Link>
      </div>
      <div className="general-cart-shipping-track" aria-hidden="true">
        <span style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
