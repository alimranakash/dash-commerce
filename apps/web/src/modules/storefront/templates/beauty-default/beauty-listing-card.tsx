"use client";

import { useStorefrontBasePath } from "../../base-path-provider";
import Link from "next/link";
import type { ProductCardProduct } from "../../components/product-listing";
import { StorefrontImage } from "../../components/storefront-image";
import type { StorefrontProductSectionSettings } from "../../customization";
import { formatStorefrontMoney } from "../../format";
import { BeautyQuickAdd } from "./beauty-quick-add";

// Every template already declares a `productCardVariant`; the shared product grid
// switches on this one value, which is how Beauty Default gets this card on all of
// its surfaces (homepage rows, shop, category, search, related, recently viewed)
// while every other template keeps the shared card untouched.
export const BEAUTY_PRODUCT_CARD_VARIANT = "beauty-soft-card";

const NEW_PRODUCT_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

export type BeautyListingCardProps = {
  currency: string;
  product: ProductCardProduct;
  section: StorefrontProductSectionSettings;
  // Quick add needs the tenant id, which the card-level product snapshot does not
  // carry; without it the card simply renders without the add button.
  storeId?: string | undefined;
  storeSlug: string;
};

export function BeautyListingCard({
  currency,
  product,
  section,
  storeId,
  storeSlug
}: BeautyListingCardProps) {
  const basePath = useStorefrontBasePath();
  const href = `${basePath}/products/${product.slug}`;
  const primaryImage = product.images[0];
  const hoverImage = section.enableHoverImage ? product.images[1] : undefined;
  const price = product.price.toString();
  const compareAtPrice = product.compareAtPrice?.toString();
  const isSoldOut = product.stockQuantity < 1;
  const isOnSale = Boolean(compareAtPrice && Number(compareAtPrice) > Number(price));
  const flag = beautyCardFlag({ isOnSale, isSoldOut, product, section });
  const placeholder = <BeautyTilePlaceholder />;

  return (
    <article className="beauty-product-tile">
      <div className="beauty-product-tile-media">
        <Link
          className={`beauty-product-tile-media-link${hoverImage ? " has-hover-image" : ""}`}
          href={href}
        >
          <StorefrontImage
            alt={primaryImage?.alt ?? product.title}
            fallback={placeholder}
            src={primaryImage?.url}
          />
          {hoverImage ? (
            // Decorative: it is the same product, so it stays out of the a11y tree
            // rather than repeating the title to screen readers.
            <span aria-hidden="true" className="beauty-product-tile-hover-image">
              <StorefrontImage alt="" fallback={placeholder} src={hoverImage.url} />
            </span>
          ) : null}
        </Link>
        {flag ? <span className="beauty-product-tile-flag">{flag}</span> : null}
        {storeId && !isSoldOut ? (
          <BeautyQuickAdd
            productId={product.id}
            productSlug={product.slug}
            storeId={storeId}
            storeSlug={storeSlug}
          />
        ) : null}
      </div>
      <div className="beauty-product-tile-body">
        <h3 className="beauty-product-tile-title">
          <Link href={href}>{product.title}</Link>
        </h3>
        <p className="beauty-product-tile-price">
          <strong>{formatStorefrontMoney(price, currency)}</strong>
          {section.enableComparePrice && isOnSale && compareAtPrice ? (
            <span>{formatStorefrontMoney(compareAtPrice, currency)}</span>
          ) : null}
        </p>
      </div>
    </article>
  );
}

function BeautyTilePlaceholder() {
  return (
    <span aria-hidden="true" className="beauty-product-tile-placeholder">
      <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect height="16" rx="2" width="20" x="2" y="4" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m2 16 5.5-5 4.5 4 3.5-3L22 17" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

// Same badge rules as the shared card - stock first, then sale, then recency - so
// only the wording and placement change for this template.
function beautyCardFlag({
  isOnSale,
  isSoldOut,
  product,
  section
}: {
  isOnSale: boolean;
  isSoldOut: boolean;
  product: ProductCardProduct;
  section: StorefrontProductSectionSettings;
}) {
  if (isSoldOut) {
    return "Sold Out";
  }

  if (!section.enableBadges) {
    return "";
  }

  if (isOnSale) {
    return "Sale";
  }

  if (Date.now() - new Date(product.createdAt).getTime() < NEW_PRODUCT_WINDOW_MS) {
    return "New";
  }

  return "";
}
