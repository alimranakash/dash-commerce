import Link from "next/link";
import type { StorefrontProductSectionSettings } from "../customization";
import type { StorefrontProduct } from "../storefront.types";
import { ProductSectionSliderControls } from "./product-section-slider-controls";
import { StorefrontImage } from "./storefront-image";

export type ProductGridProps = {
  currency: string;
  gridId?: string | undefined;
  products: StorefrontProduct[];
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
  product: StorefrontProduct;
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
        fallback={product.title}
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
  fallback: string;
  hoverSrc?: string | null | undefined;
  src?: string | null | undefined;
}) {
  return (
    <div className="general-product-listing-image">
      <StorefrontImage alt={alt} fallback={fallback} src={src} />
      {hoverSrc ? (
        <span className="general-product-listing-hover-image">
          <StorefrontImage alt={alt} fallback={fallback} src={hoverSrc} />
        </span>
      ) : null}
    </div>
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
      <strong>{formatMoney(price, currency)}</strong>
      {compareAtPrice && Number(compareAtPrice) > Number(price) ? (
        <span>{formatMoney(compareAtPrice, currency)}</span>
      ) : null}
    </p>
  );
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}

function productBadge(product: StorefrontProduct) {
  if (product.stockQuantity <= 0) {
    return "LIMITED";
  }

  if (product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price)) {
    return "SALE";
  }

  if (Date.now() - product.createdAt.getTime() < 1000 * 60 * 60 * 24 * 30) {
    return "NEW";
  }

  return "";
}
