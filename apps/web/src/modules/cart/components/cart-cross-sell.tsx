"use client";

import { Check, Plus, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StorefrontImage } from "../../storefront/components/storefront-image";
import { formatStorefrontMoney } from "../../storefront/format";
import type { CartCrossSellProduct } from "../cart-cross-sell";
import { notifyCartUpdated, submitCartAction } from "./cart-client-actions";

type CartCrossSellProps = {
  currency: string;
  /** "drawer" stacks the cards; "page" lays them out in a row. */
  layout: "drawer" | "page";
  products: CartCrossSellProduct[];
  storeId: string;
  storeSlug: string;
  title?: string;
};

export function CartCrossSell({
  currency,
  layout,
  products,
  storeId,
  storeSlug,
  title = "Goes well with your cart"
}: CartCrossSellProps) {
  if (products.length === 0) {
    return null;
  }

  return (
    <section className={`sf-cart-crosssell sf-cart-crosssell-${layout}`} aria-labelledby="cart-crosssell-title">
      <h3 id="cart-crosssell-title">{title}</h3>
      <div className="sf-cart-crosssell-items">
        {products.map((product) => (
          <CartCrossSellCard
            currency={currency}
            key={product.id}
            product={product}
            storeId={storeId}
            storeSlug={storeSlug}
          />
        ))}
      </div>
    </section>
  );
}

function CartCrossSellCard({
  currency,
  product,
  storeId,
  storeSlug
}: {
  currency: string;
  product: CartCrossSellProduct;
  storeId: string;
  storeSlug: string;
}) {
  const router = useRouter();
  const [added, setAdded] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const hasComparePrice =
    product.compareAtPrice !== null && Number(product.compareAtPrice) > Number(product.price);

  function addProduct() {
    setError("");

    startTransition(async () => {
      const result = await submitCartAction({
        cartAction: "add",
        productId: product.id,
        quantity: "1",
        source: "CART_CROSS_SELL",
        storeId,
        storeSlug
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      // The card stays in place saying "Added" rather than disappearing under
      // the pointer: the row re-renders from the refreshed cart a moment later,
      // and a button that vanishes mid-tap loses whichever one is tapped next.
      setAdded(true);
      notifyCartUpdated();
      router.refresh();
    });
  }

  return (
    <div className="sf-cart-crosssell-card">
      <div className="sf-cart-crosssell-image">
        <StorefrontImage
          alt={product.title}
          fallback={<ShoppingBag className="h-4 w-4" />}
          src={product.imageUrl}
        />
      </div>
      <div className="sf-cart-crosssell-meta">
        <strong>{product.title}</strong>
        <span>
          {formatStorefrontMoney(product.price, currency)}
          {hasComparePrice ? <s>{formatStorefrontMoney(product.compareAtPrice ?? "0", currency)}</s> : null}
        </span>
        {error ? <em className="sf-cart-crosssell-error">{error}</em> : null}
      </div>
      <button
        className={`sf-cart-crosssell-add${added ? " is-added" : ""}`}
        disabled={isPending || added}
        onClick={addProduct}
        type="button"
      >
        {added ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
        {added ? "Added" : isPending ? "Adding" : "Add"}
      </button>
    </div>
  );
}
