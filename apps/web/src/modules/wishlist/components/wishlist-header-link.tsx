"use client";

import { Heart } from "lucide-react";
import Link from "next/link";
import { useStorefrontBasePath } from "../../storefront/base-path-provider";
import { useWishlist } from "./wishlist-provider";

/**
 * The header's saved-products count.
 *
 * A client component reading the same provider the hearts write to, so pressing
 * one on a product card moves this number without a page load — the count and
 * the heart are one piece of state, not two reads that have to be kept in step.
 *
 * The class and icon size are the caller's because the three storefront headers
 * size their icons differently; the behaviour is the same in all of them.
 */
export function WishlistHeaderLink({
  className = "sf-icon-action",
  iconClassName,
  iconSize
}: {
  className?: string | undefined;
  iconClassName?: string | undefined;
  iconSize?: number | undefined;
}) {
  const basePath = useStorefrontBasePath();
  const { count } = useWishlist();
  const label = count === 1 ? "Wishlist, 1 product saved" : `Wishlist, ${count} products saved`;

  return (
    <Link
      aria-label={label}
      className={`${className} sf-wishlist-icon-action`.trim()}
      href={`${basePath}/wishlist`}
    >
      <Heart
        className={iconClassName ?? "h-4 w-4"}
        {...(iconSize !== undefined ? { size: iconSize } : {})}
      />
      {count > 0 ? <span>{count}</span> : null}
    </Link>
  );
}
