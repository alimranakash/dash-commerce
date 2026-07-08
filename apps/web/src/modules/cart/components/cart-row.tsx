"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { StorefrontImage } from "../../storefront/components/storefront-image";
import type { CartItem } from "../cart.types";
import { submitCartAction } from "./cart-client-actions";
import { QuantitySelector } from "./quantity-selector";

type CartRowProps = {
  currency: string;
  item: CartItem;
  showBrand: boolean;
  showRemoveButton: boolean;
  showVariant: boolean;
  storeId: string;
  storeName: string;
  storeSlug: string;
};

export function CartRow({
  currency,
  item,
  showBrand,
  showRemoveButton,
  showVariant,
  storeId,
  storeName,
  storeSlug
}: CartRowProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [quantity, setQuantity] = useState(item.quantity);
  const [isPending, startTransition] = useTransition();

  function updateQuantity(nextQuantity: number) {
    const previousQuantity = quantity;
    setQuantity(nextQuantity);
    setError("");

    startTransition(async () => {
      const result = await submitCartAction({
        cartAction: "update",
        lineId: item.lineId,
        productId: item.productId,
        quantity: String(nextQuantity),
        storeId,
        storeSlug
      });

      if (!result.ok) {
        setQuantity(previousQuantity);
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  function removeItem() {
    setError("");

    startTransition(async () => {
      const result = await submitCartAction({
        cartAction: "remove",
        lineId: item.lineId,
        productId: item.productId,
        storeId,
        storeSlug
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.refresh();
    });
  }

  return (
    <div className="general-cart-row">
      <div className="general-cart-product-cell">
        <div className="general-cart-product-image">
          <StorefrontImage alt={item.title} fallback="Product image" src={item.image} />
        </div>
        <div>
          {showBrand ? <p>{storeName}</p> : null}
          <h2>{item.title}</h2>
          {showVariant ? <span>{item.variantTitle ?? "Standard"}</span> : null}
          {error ? <strong className="general-cart-row-error">{error}</strong> : null}
        </div>
      </div>
      <div className="general-cart-price-cell" data-label="Price">
        {formatMoney(item.price, currency)}
      </div>
      <div className="general-cart-quantity-cell" data-label="Quantity">
        <QuantitySelector disabled={isPending} onChange={updateQuantity} quantity={quantity} />
      </div>
      <div className="general-cart-total-cell" data-label="Total">
        {formatMoney(Number(item.price) * quantity, currency)}
      </div>
      <div className="general-cart-remove-cell">
        {showRemoveButton ? (
          <button
            aria-label={`Remove ${item.title}`}
            className="general-cart-remove"
            disabled={isPending}
            onClick={removeItem}
            type="button"
          >
            <Trash2 aria-hidden="true" size={16} strokeWidth={1.7} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function formatMoney(value: number | string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
