"use client";

import { Heart } from "lucide-react";
import type { FormEvent } from "react";
import { useWishlist } from "./wishlist-provider";

type WishlistButtonProps = {
  className?: string | undefined;
  productId: string;
  productSlug?: string | undefined;
  /**
   * `icon` is the heart that floats over a product card; `inline` is the
   * labelled button on a product page. Same behaviour, different room for words.
   */
  variant?: "icon" | "inline" | undefined;
};

/**
 * One saved product, toggled.
 *
 * A real form posting to `/api/wishlist`, intercepted on submit — the same shape
 * `BeautyQuickAdd` uses, and for the same reason: the heart keeps working with
 * client JS disabled, where it becomes a normal POST and a redirect back to the
 * wishlist.
 *
 * It must not be rendered inside an anchor. Product cards that are one big link
 * put the link behind the card as an overlay instead, which is what keeps a
 * button-inside-a-link out of the markup.
 */
export function WishlistButton({
  className,
  productId,
  productSlug,
  variant = "icon"
}: WishlistButtonProps) {
  const { isPending, isSaved, storeSlug, toggle } = useWishlist();
  const saved = isSaved(productId);
  const pending = isPending(productId);
  const label = saved ? "Remove from wishlist" : "Save to wishlist";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Cards are clickable surfaces; without this the heart would also open the
    // product it is sitting on.
    event.stopPropagation();

    if (pending) {
      return;
    }

    await toggle(productId, productSlug);
  }

  return (
    <form
      action="/api/wishlist"
      className={`sf-wishlist-button sf-wishlist-button-${variant}${saved ? " is-saved" : ""}${className ? ` ${className}` : ""}`}
      method="post"
      onClick={(event) => event.stopPropagation()}
      onSubmit={handleSubmit}
    >
      <input name="wishlistAction" type="hidden" value="toggle" />
      <input name="storeSlug" type="hidden" value={storeSlug} />
      <input name="productId" type="hidden" value={productId} />
      {productSlug ? <input name="productSlug" type="hidden" value={productSlug} /> : null}
      <button
        aria-label={label}
        aria-pressed={saved}
        disabled={pending}
        title={label}
        type="submit"
      >
        <Heart aria-hidden="true" className="sf-wishlist-heart" />
        {variant === "inline" ? <span>{saved ? "Saved" : "Wishlist"}</span> : null}
      </button>
    </form>
  );
}
