"use client";

import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";
import { notifyCartUpdated, submitCartAction } from "../../cart/components/cart-client-actions";

type ProductPurchasePanelProps = {
  addToCartButtonColor?: string;
  addToCartButtonRadius?: number;
  addToCartText?: string;
  buyNowEnabled?: boolean;
  maxQuantity: number;
  productId: string;
  productSlug: string;
  secondaryActionsEnabled?: boolean;
  storeId: string;
  storeSlug: string;
  variantId?: string | null;
};

export function ProductPurchasePanel({
  addToCartButtonColor,
  addToCartButtonRadius,
  addToCartText = "Add to Cart",
  buyNowEnabled = true,
  maxQuantity,
  productId,
  productSlug,
  secondaryActionsEnabled = true,
  storeId,
  storeSlug,
  variantId
}: ProductPurchasePanelProps) {
  const isUnavailable = maxQuantity < 1;
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const safeMax = Math.max(maxQuantity, 1);
  const buttonStyle = {
    "--product-add-button-bg": addToCartButtonColor,
    "--product-add-button-radius": addToCartButtonRadius !== undefined ? `${addToCartButtonRadius}px` : undefined
  } as CSSProperties;

  function updateQuantity(nextQuantity: number) {
    setQuantity(Math.min(Math.max(nextQuantity, 1), safeMax));
  }

  async function addCurrentSelection() {
    setError("");
    setIsSubmitting(true);

    const result = await submitCartAction({
      cartAction: "add",
      productId,
      productSlug,
      quantity: String(quantity),
      storeId,
      storeSlug,
      ...(variantId ? { variantId } : {})
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return false;
    }

    return true;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isUnavailable || isSubmitting) {
      return;
    }

    if (await addCurrentSelection()) {
      notifyCartUpdated();
      router.refresh();
    }
  }

  // Buy Now is the same add, then straight to checkout instead of opening the
  // mini cart.
  async function handleBuyNow() {
    if (isUnavailable || isSubmitting) {
      return;
    }

    if (await addCurrentSelection()) {
      router.push(`/s/${storeSlug}/checkout`);
    }
  }

  return (
    <div className="sf-purchase-panel">
      <form action="/api/cart" className="sf-purchase-box" method="post" onSubmit={handleSubmit} style={buttonStyle}>
        <input name="cartAction" type="hidden" value="add" />
        <input name="storeId" type="hidden" value={storeId} />
        <input name="storeSlug" type="hidden" value={storeSlug} />
        <input name="productId" type="hidden" value={productId} />
        <input name="productSlug" type="hidden" value={productSlug} />
        {variantId ? <input name="variantId" type="hidden" value={variantId} /> : null}

        <div className="sf-quantity-row">
          <span>Quantity</span>
          <div className="sf-quantity-control">
            <button
              disabled={isUnavailable || quantity <= 1}
              onClick={() => updateQuantity(quantity - 1)}
              type="button"
            >
              -
            </button>
            <input
              aria-label="Quantity"
              disabled={isUnavailable}
              max={safeMax}
              min="1"
              name="quantity"
              onChange={(event) => updateQuantity(Number(event.target.value) || 1)}
              type="number"
              value={quantity}
            />
            <button
              disabled={isUnavailable || quantity >= safeMax}
              onClick={() => updateQuantity(quantity + 1)}
              type="button"
            >
              +
            </button>
          </div>
        </div>

        <div className="sf-purchase-actions">
          <button className="sf-cart-submit" disabled={isUnavailable || isSubmitting} type="submit">
            {isSubmitting ? "Adding..." : addToCartText}
          </button>
          {buyNowEnabled ? (
            <button
              className="sf-buy-now"
              disabled={isUnavailable || isSubmitting}
              onClick={handleBuyNow}
              type="button"
            >
              Buy Now
            </button>
          ) : null}
        </div>
        {error ? <p className="sf-alert">{error}</p> : null}
      </form>

      {secondaryActionsEnabled ? (
        <div className="sf-secondary-actions">
          <button type="button">Wishlist</button>
          <button type="button">Share</button>
        </div>
      ) : null}
    </div>
  );
}
