import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { StorefrontProductSectionSettings } from "../customization";
import { formatStorefrontMoney } from "../format";
import { ProductSectionSliderControls } from "./product-section-slider-controls";
import { StorefrontImage } from "./storefront-image";

// The card only ever reads these fields, so a plain client-side snapshot (the
// recently viewed rail) renders through the same component as a Prisma row.
export type ProductCardProduct = {
  compareAtPrice?: { toString(): string } | null | undefined;
  createdAt: Date | string;
  id: string;
  images: Array<{ alt?: string | null | undefined; url: string }>;
  price: { toString(): string };
  slug: string;
  stockQuantity: number;
  title: string;
};

export type ProductGridProps = {
  currency: string;
  gridId?: string | undefined;
  products: ProductCardProduct[];
  section: StorefrontProductSectionSettings;
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

export function ProductGrid({ currency, gridId, products, section, storeSlug }: ProductGridProps) {
  return (
    <div
      id={gridId}
      className={`general-product-listing-grid general-product-listing-grid-${section.columns} general-product-listing-${section.mode}`}
      // Page-scoped stylesheet rules used to pin the column count per surface,
      // which outranked the class above; the inline variable is what the
      // Columns setting actually drives now.
      style={{ "--product-grid-columns": section.columns } as CSSProperties}
    >
      {products.slice(0, section.count).map((product) => (
        <ProductCard
          currency={currency}
          key={product.id}
          product={product}
          section={section}
          storeSlug={storeSlug}
        />
      ))}
    </div>
  );
}

export function ProductCard({
  currency,
  product,
  section,
  storeSlug
}: {
  currency: string;
  product: ProductCardProduct;
  section: StorefrontProductSectionSettings;
  storeSlug: string;
}) {
  const primaryImage = product.images[0];
  const hoverImage = section.enableHoverImage ? product.images[1] : null;
  const compareAtPrice = product.compareAtPrice?.toString();
  const price = product.price.toString();
  const badge = productBadge(product);
  const variantCount = product.images.length > 1 ? `${product.images.length} Images` : "";

  return (
    <Link className="general-product-listing-card" href={`/s/${storeSlug}/products/${product.slug}`}>
      <ProductImage
        alt={primaryImage?.alt ?? product.title}
        hoverSrc={hoverImage?.url}
        src={primaryImage?.url}
      />
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
    </Link>
  );
}

export function ProductImage({
  alt,
  fallback,
  hoverSrc,
  src
}: {
  alt: string;
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
