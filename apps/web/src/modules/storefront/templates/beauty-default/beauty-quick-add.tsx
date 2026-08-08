"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { notifyCartUpdated, submitCartAction } from "../../../cart/components/cart-client-actions";

type BeautyQuickAddProps = {
  productId: string;
  productSlug: string;
  storeId: string;
  storeSlug: string;
};

// The card stays minimal, so the add stays out of the way until hover (CSS) and
// posts in place instead of navigating to the cart page. The real form action is
// kept so the button still works without client JS.
export function BeautyQuickAdd({
  productId,
  productSlug,
  storeId,
  storeSlug
}: BeautyQuickAddProps) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    setError("");
    setIsSubmitting(true);

    const result = await submitCartAction({
      cartAction: "add",
      productId,
      productSlug,
      quantity: "1",
      storeId,
      storeSlug
    });

    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    notifyCartUpdated();
    router.refresh();
  }

  return (
    <form
      action="/api/cart"
      className="beauty-product-tile-quick-add"
      method="post"
      onSubmit={handleSubmit}
    >
      <input name="cartAction" type="hidden" value="add" />
      <input name="storeId" type="hidden" value={storeId} />
      <input name="storeSlug" type="hidden" value={storeSlug} />
      <input name="productId" type="hidden" value={productId} />
      <input name="productSlug" type="hidden" value={productSlug} />
      <input name="quantity" type="hidden" value="1" />
      <button disabled={isSubmitting} type="submit">
        {isSubmitting ? "Adding..." : "Add to cart"}
      </button>
      {error ? <p className="beauty-product-tile-error">{error}</p> : null}
    </form>
  );
}
