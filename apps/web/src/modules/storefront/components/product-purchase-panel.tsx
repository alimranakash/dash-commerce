"use client";

import { Minus, Plus } from "lucide-react";
import { useStorefrontBasePath } from "../base-path-provider";
import { useRouter } from "next/navigation";
import { useState, type CSSProperties, type FormEvent } from "react";
import { notifyCartUpdated, submitCartAction } from "../../cart/components/cart-client-actions";
import { WishlistButton } from "../../wishlist/components/wishlist-button";

type ProductPurchasePanelProps = {
  addToCartButtonColor?: string;
  addToCartButtonRadius?: number;
  addToCartText?: string;
  className?: string | undefined;
  directCheckoutEnabled?: boolean;
  directCheckoutText?: string;
  maxQuantity: number;
  /**
   * Told which action finished, once the server has said yes.
   *
   * Quick View closes its dialog on it. Without this the direct-checkout push
   * would navigate the page underneath and leave the modal sitting over the
   * checkout form, since a client navigation never unmounts the layout the
   * dialog is mounted from.
   */
  onCompleted?: ((action: "add" | "direct") => void) | undefined;
  productId: string;
  productSlug: string;
  /**
   * Whether the shopper picks a quantity here. Off, the panel still buys one —
   * the count is posted from a hidden field, so the no-JS form path is unchanged.
   */
  quantityEnabled?: boolean | undefined;
  secondaryActionsEnabled?: boolean;
  storeId: string;
  storeSlug: string;
  variantId?: string | null;
  wishlistEnabled?: boolean | undefined;
};

export function ProductPurchasePanel({
  addToCartButtonColor,
  addToCartButtonRadius,
  addToCartText = "Add to Cart",
  className,
  directCheckoutEnabled = true,
  directCheckoutText = "Direct Checkout",
  maxQuantity,
  onCompleted,
  productId,
  productSlug,
  quantityEnabled = true,
  secondaryActionsEnabled = true,
  storeId,
  storeSlug,
  variantId,
  wishlistEnabled = true
}: ProductPurchasePanelProps) {
  const basePath = useStorefrontBasePath();
  const isUnavailable = maxQuantity < 1;
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const safeMax = Math.max(maxQuantity, 1);
  const buttonStyle = {
    "--product-add-button-bg": addToCartButtonColor,
    "--product-add-button-radius":
      addToCartButtonRadius !== undefined ? `${addToCartButtonRadius}px` : undefined
  } as CSSProperties;

  function updateQuantity(nextQuantity: number) {
    setQuantity(Math.min(Math.max(nextQuantity, 1), safeMax));
  }

  async function submitSelection(cartAction: "add" | "direct") {
    setError("");
    setIsSubmitting(true);

    const result = await submitCartAction({
      cartAction,
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

    if (await submitSelection("add")) {
      notifyCartUpdated();
      router.refresh();
      onCompleted?.("add");
    }
  }

  /**
   * Direct Checkout: this product, on its own, straight to the checkout form.
   *
   * The line goes into a basket of its own rather than into the cart, so a
   * shopper who already had three things in there is billed for the one they
   * asked for and still has the three when they come back. That is also why
   * nothing here calls `notifyCartUpdated` — the cart did not change, and a
   * header that ticked up would be counting something the order will not
   * include. `?buy=direct` is what tells the checkout page which basket to read.
   */
  async function handleDirectCheckout() {
    if (isUnavailable || isSubmitting) {
      return;
    }

    if (await submitSelection("direct")) {
      onCompleted?.("direct");
      router.push(`${basePath}/checkout?buy=direct`);
    }
  }

  return (
    <div className={`sf-purchase-panel${className ? ` ${className}` : ""}`}>
      <form
        action="/api/cart"
        className="sf-purchase-box"
        method="post"
        onSubmit={handleSubmit}
        style={buttonStyle}
      >
        <input name="cartAction" type="hidden" value="add" />
        <input name="storeId" type="hidden" value={storeId} />
        <input name="storeSlug" type="hidden" value={storeSlug} />
        <input name="productId" type="hidden" value={productId} />
        <input name="productSlug" type="hidden" value={productSlug} />
        {variantId ? <input name="variantId" type="hidden" value={variantId} /> : null}

        {/* The stepper is the seller's to hide; the field it posts is not. With
          the row gone a hidden input carries the count, so the no-JS form path
          posts the same number the JS path submits rather than falling back to
          the cart route's own default by accident. */}
        {quantityEnabled ? (
          <div className="sf-quantity-row">
            <span>Quantity</span>
            {/* A labelled group rather than three loose controls: a screen reader
              lands on "Quantity, 1" instead of on a button called "-". The glyphs
              are icons for the same reason the rest of the storefront uses them —
              a hyphen and a plus sign set in the page font are two different
              optical weights, which is what made the stepper look broken. */}
            <div aria-label="Quantity" className="sf-quantity-control" role="group">
              <button
                aria-label="Decrease quantity"
                disabled={isUnavailable || quantity <= 1}
                onClick={() => updateQuantity(quantity - 1)}
                type="button"
              >
                <Minus aria-hidden="true" />
              </button>
              <input
                aria-label="Quantity"
                disabled={isUnavailable}
                // A phone should offer digits, not a full keyboard, and the
                // browser's own spinner arrows are hidden in CSS — the two
                // buttons either side are the affordance.
                inputMode="numeric"
                max={safeMax}
                min="1"
                name="quantity"
                onChange={(event) => updateQuantity(Number(event.target.value) || 1)}
                type="number"
                value={quantity}
              />
              <button
                aria-label="Increase quantity"
                disabled={isUnavailable || quantity >= safeMax}
                onClick={() => updateQuantity(quantity + 1)}
                type="button"
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : (
          <input name="quantity" type="hidden" value={quantity} />
        )}

        <div className="sf-purchase-actions">
          <button className="sf-cart-submit" disabled={isUnavailable || isSubmitting} type="submit">
            {isSubmitting ? "Adding..." : addToCartText}
          </button>
          {directCheckoutEnabled ? (
            <button
              className="sf-buy-now"
              disabled={isUnavailable || isSubmitting}
              onClick={handleDirectCheckout}
              type="button"
            >
              {directCheckoutText}
            </button>
          ) : null}
        </div>
        {error ? <p className="sf-alert">{error}</p> : null}
      </form>

      {/* Saving is not one of the decorative secondary actions. Share is the
        seller's to switch off and the templates that lay out their own product
        page do switch it off; the wishlist is a real feature, and it would have
        no way in on those pages if it were behind the same flag.

        `wishlistEnabled` is a different question again, and only Quick View asks
        it: the heart is already on the card the modal was opened from, so a
        seller may reasonably not want a second one three inches away. */}
      {wishlistEnabled || secondaryActionsEnabled ? (
        <div
          className={`sf-secondary-actions${wishlistEnabled && secondaryActionsEnabled ? "" : " sf-secondary-actions-single"}`}
        >
          {wishlistEnabled ? (
            <WishlistButton productId={productId} productSlug={productSlug} variant="inline" />
          ) : null}
          {secondaryActionsEnabled ? <button type="button">Share</button> : null}
        </div>
      ) : null}
    </div>
  );
}
