"use client";

import { useState } from "react";

type ProductPurchasePanelProps = {
  maxQuantity: number;
  productId: string;
  productSlug: string;
  storeId: string;
  storeSlug: string;
};

export function ProductPurchasePanel({
  maxQuantity,
  productId,
  productSlug,
  storeId,
  storeSlug
}: ProductPurchasePanelProps) {
  const isUnavailable = maxQuantity < 1;
  const [quantity, setQuantity] = useState(1);
  const safeMax = Math.max(maxQuantity, 1);

  function updateQuantity(nextQuantity: number) {
    setQuantity(Math.min(Math.max(nextQuantity, 1), safeMax));
  }

  return (
    <div className="sf-purchase-panel">
      <form action="/api/cart" className="sf-purchase-box" method="post">
        <input name="cartAction" type="hidden" value="add" />
        <input name="storeId" type="hidden" value={storeId} />
        <input name="storeSlug" type="hidden" value={storeSlug} />
        <input name="productId" type="hidden" value={productId} />
        <input name="productSlug" type="hidden" value={productSlug} />

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
          <button className="sf-cart-submit" disabled={isUnavailable} type="submit">
            Add to Cart
          </button>
          <button className="sf-buy-now" disabled={isUnavailable} type="button">
            Buy Now
          </button>
        </div>
      </form>

      <div className="sf-secondary-actions">
        <button type="button">Wishlist</button>
        <button type="button">Share</button>
      </div>
    </div>
  );
}
