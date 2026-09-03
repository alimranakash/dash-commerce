"use client";

import { useStorefrontBasePath } from "../base-path-provider";
import Link from "next/link";
import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { StorefrontProductSectionSettings } from "../customization";
import { formatStorefrontMoney } from "../format";
import type { ProductCardProduct } from "../product-card-data";
import { QuickViewTrigger } from "../../quick-view/components/quick-view-trigger";
import {
  BEAUTY_PRODUCT_CARD_VARIANT,
  BeautyListingCard
} from "../templates/beauty-default/beauty-listing-card";
import { WishlistButton } from "../../wishlist/components/wishlist-button";
import { ProductSectionSliderControls } from "./product-section-slider-controls";
import { StorefrontImage } from "./storefront-image";

export type ProductGridProps = {
  // The active template's `productCardVariant`. Only variants this module knows
  // about swap the card; anything else keeps the shared card below.
  cardVariant?: string | undefined;
  currency: string;
  gridId?: string | undefined;
  /**
   * Something to drop into the grid as a full-width cell — today, a notification
   * bar the seller placed among the products.
   *
   * A rendered node rather than a flag, so this component stays presentational
   * and knows nothing about announcements: it is handed something to place and
   * the count to place it after. Both must be set for anything to happen, and
   * the caller is expected to pass null rather than an element that renders
   * nothing — an empty cell would still take a column.
   */
  inlineSlot?: ReactNode;
  /** How many cards come before `inlineSlot`. Null leaves the grid untouched. */
  inlineSlotAfter?: number | null | undefined;
  products: ProductCardProduct[];
  section: StorefrontProductSectionSettings;
  // Only needed by cards that add to the cart from the grid.
  storeId?: string | undefined;
  storeSlug: string;
};

export type SectionHeaderProps = {
  ctaHref?: string | undefined;
  ctaText?: string | undefined;
  id?: string | undefined;
  sliderTargetId?: string | undefined;
  subtitle?: string | undefined;
  title: string;
};

export function SectionHeader({
  ctaHref,
  ctaText,
  id,
  sliderTargetId,
  subtitle,
  title
}: SectionHeaderProps) {
  return (
    <div className="general-product-section-header">
      <div className="general-product-section-copy">
        <h2 id={id}>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <div className="general-product-section-toolbar">
        {ctaHref && ctaText ? (
          <Link className="general-product-section-cta" href={ctaHref}>
            {ctaText} <span aria-hidden="true">&rsaquo;</span>
          </Link>
        ) : null}
        {sliderTargetId ? <ProductSectionSliderControls targetId={sliderTargetId} /> : null}
      </div>
    </div>
  );
}

export function ProductGrid({
  cardVariant,
  currency,
  gridId,
  inlineSlot = null,
  inlineSlotAfter = null,
  products,
  section,
  storeId,
  storeSlug
}: ProductGridProps) {
  const visible = products.slice(0, section.count);
  // Clamped to the cards actually on screen: a bar set to appear after twelve
  // products on a page showing eight would otherwise vanish, and "after the last
  // one" is the honest reading of it. Null when there is nothing to place.
  const slotIndex =
    inlineSlot && inlineSlotAfter !== null && inlineSlotAfter !== undefined
      ? Math.min(Math.max(1, inlineSlotAfter), visible.length)
      : null;

  return (
    <div
      id={gridId}
      className={`general-product-listing-grid general-product-listing-grid-${section.columns} general-product-listing-${section.mode}`}
      // Page-scoped stylesheet rules used to pin the column count per surface,
      // which outranked the class above; the inline variable is what the
      // Columns setting actually drives now.
      style={{ "--product-grid-columns": section.columns } as CSSProperties}
    >
      {visible.map((product, index) => (
        <Fragment key={product.id}>
          {cardVariant === BEAUTY_PRODUCT_CARD_VARIANT ? (
            <BeautyListingCard
              currency={currency}
              product={product}
              section={section}
              storeId={storeId}
              storeSlug={storeSlug}
            />
          ) : (
            <ProductCard
              currency={currency}
              product={product}
              section={section}
              storeSlug={storeSlug}
            />
          )}
          {/* After the card, not before it, so "after 4 products" means the
              shopper has seen four. Spans every column via `.sf-grid-slot`, since
              a card-sized advert in a row of products is how a shopper loses
              their place. */}
          {slotIndex === index + 1 ? <div className="sf-grid-slot">{inlineSlot}</div> : null}
        </Fragment>
      ))}
    </div>
  );
}

export function ProductCard({
  currency,
  product,
  section
}: {
  currency: string;
  product: ProductCardProduct;
  section: StorefrontProductSectionSettings;
  storeSlug: string;
}) {
  const basePath = useStorefrontBasePath();
  const primaryImage = product.images[0];
  const hoverImage = section.enableHoverImage ? product.images[1] : null;
  const compareAtPrice = product.compareAtPrice ?? undefined;
  const price = product.price;
  const badge = productBadge(product);
  const variantCount = product.images.length > 1 ? `${product.images.length} Images` : "";

  return (
    // The whole card still opens the product, but it can no longer *be* the
    // anchor: the heart is a button, and a button inside an anchor is markup no
    // two browsers agree about. The link covers the card from behind instead,
    // which leaves the click target exactly where it was.
    <article className="general-product-listing-card">
      <Link
        className="general-product-listing-card-link"
        href={`${basePath}/products/${product.slug}`}
      >
        <span className="sr-only">{product.title}</span>
      </Link>
      <ProductImage
        alt={primaryImage?.alt ?? product.title}
        hoverSrc={hoverImage?.url}
        src={primaryImage?.url}
      >
        {/* Inside the picture, not under the title: it is a way of looking at
          the photograph more closely, and the card is taller than the frame —
          placed against the card it would land under the price. Renders nothing
          at all when the seller has Quick View off. */}
        <QuickViewTrigger productSlug={product.slug} productTitle={product.title} />
      </ProductImage>
      <WishlistButton productId={product.id} productSlug={product.slug} />
      <div className="general-product-listing-meta">
        <div>
          <h3>{product.title}</h3>
          <ProductPrice
            compareAtPrice={section.enableComparePrice ? compareAtPrice : undefined}
            currency={currency}
            price={price}
          />
        </div>
        <div className="general-product-listing-flags">
          {section.enableBadges && badge ? <ProductBadge label={badge} /> : null}
          {section.enableVariants && variantCount ? <span>{variantCount}</span> : null}
        </div>
      </div>
    </article>
  );
}

export function ProductImage({
  alt,
  children,
  fallback,
  hoverSrc,
  src
}: {
  alt: string;
  /**
   * Anything that belongs over the picture rather than over the card — today,
   * the Quick View trigger.
   *
   * A slot rather than a flag, because only this element is positioned: the
   * card wraps the picture *and* the title and price, so a button placed
   * against the card would sit under the price instead of on the photograph.
   */
  children?: ReactNode;
  fallback?: ReactNode;
  hoverSrc?: string | null | undefined;
  src?: string | null | undefined;
}) {
  // Without an explicit label the card falls back to a neutral image glyph
  // rather than stamping the product title over an empty frame.
  const placeholder = fallback ?? <ProductImagePlaceholder />;

  return (
    <div className="general-product-listing-image">
      <StorefrontImage alt={alt} fallback={placeholder} src={src} />
      {hoverSrc ? <ProductHoverImage alt={alt} fallback={placeholder} src={hoverSrc} /> : null}
      {children}
    </div>
  );
}

// Template cards keep their own media frame but reuse this overlay, so the
// second-image swap stays one implementation instead of one per template.
export function ProductHoverImage({
  alt,
  fallback,
  src
}: {
  alt: string;
  fallback: ReactNode;
  src: string;
}) {
  return (
    <span className="general-product-listing-hover-image">
      <StorefrontImage alt={alt} fallback={fallback} src={src} />
    </span>
  );
}

export function ProductImagePlaceholder() {
  return (
    <span aria-hidden="true" className="general-product-listing-image-placeholder">
      <svg fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
        <rect height="16" rx="2" width="20" x="2" y="4" />
        <circle cx="8.5" cy="9.5" r="1.5" />
        <path d="m2 16 5.5-5 4.5 4 3.5-3L22 17" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function ProductBadge({ label }: { label: string }) {
  return <em className="general-product-listing-badge">{label}</em>;
}

export function ProductPrice({
  compareAtPrice,
  currency,
  price
}: {
  compareAtPrice?: string | undefined;
  currency: string;
  price: string;
}) {
  return (
    <p className="general-product-listing-price">
      <strong>{formatStorefrontMoney(price, currency)}</strong>
      {compareAtPrice && Number(compareAtPrice) > Number(price) ? (
        <span>{formatStorefrontMoney(compareAtPrice, currency)}</span>
      ) : null}
    </p>
  );
}

function productBadge(product: ProductCardProduct) {
  if (product.stockQuantity <= 0) {
    return "LIMITED";
  }

  if (product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price)) {
    return "SALE";
  }

  if (Date.now() - new Date(product.createdAt).getTime() < 1000 * 60 * 60 * 24 * 30) {
    return "NEW";
  }

  return "";
}
