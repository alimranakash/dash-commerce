import { storefrontBasePath } from "../../base-path";
import Link from "next/link";
import type { ReactNode } from "react";
import { HeroSlider } from "../../components/hero-slider";
import { ProductGrid, SectionHeader } from "../../components/product-listing";
import type {
  StorefrontAdvancedSettings,
  StorefrontProductSectionSettings
} from "../../customization";
import { storefrontSectionHref } from "../../product-sections";
import {
  GeneralRecommendedForYouClient,
  type GeneralRecommendedCategory,
  type GeneralRecommendedProduct
} from "./general-recommended-for-you";
import type { StorefrontProduct } from "../../storefront.types";

type GeneralSectionWrapperProps = {
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  eyebrow?: string;
  id?: string;
  title: string;
};

type GeneralProductGridProps = {
  currency: string;
  gridId?: string;
  products: StorefrontProduct[];
  section: StorefrontProductSectionSettings;
  storeSlug: string;
};

type GeneralCategory = {
  id: string;
  imageUrl?: string | null;
  name: string;
  slug: string;
};

export function GeneralSectionWrapper({
  actionHref,
  actionLabel = "View all",
  children,
  eyebrow,
  id,
  title
}: GeneralSectionWrapperProps) {
  return (
    <section className="general-home-section" id={id} aria-labelledby={id ? `${id}-title` : undefined}>
      <div className="general-section-heading">
        <div>
          {eyebrow ? <p>{eyebrow}</p> : null}
          <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
        </div>
        {actionHref ? <Link href={actionHref}>{actionLabel}</Link> : null}
      </div>
      {children}
    </section>
  );
}

export function GeneralHero({
  advancedSettings,
  heroImageUrl,
  primaryDomain,
  storeName,
  storeSlug,
  subtitle,
  title
}: {
  advancedSettings?: StorefrontAdvancedSettings | null | undefined;
  heroImageUrl?: string | null | undefined;
  primaryDomain: string | undefined;
  storeName: string;
  storeSlug: string;
  subtitle?: string | null | undefined;
  title?: string | null | undefined;
}) {
  void primaryDomain;

  return (
    <HeroSlider
      fallbackImageUrl={heroImageUrl}
      settings={advancedSettings}
      storeSlug={storeSlug}
      subtitle={subtitle || `Shop the latest collection from ${storeName} with reliable delivery and a seamless checkout experience.`}
      title={title || "Discover Quality Products for Every Lifestyle"}
    />
  );
}

export async function GeneralCategoryStrip({
  categories,
  storeSlug
}: {
  categories: GeneralCategory[];
  storeSlug: string;
}) {
  const basePath = await storefrontBasePath(storeSlug);
  // A store with no categories shows nothing here rather than a strip of
  // placeholder names that link to pages which do not exist.
  if (categories.length === 0) {
    return null;
  }

  const visibleCategories = categories.slice(0, 6).map((category) => ({
    icon: category.name.trim().slice(0, 2),
    imageUrl: category.imageUrl,
    name: category.name.trim(),
    slug: category.slug
  }));

  return (
    <div className="general-category-strip">
      {visibleCategories.map((category) => (
        <Link className="general-category-bubble" href={`${basePath}/categories/${category.slug}`} key={category.slug}>
          <span suppressHydrationWarning>
            {category.imageUrl ? <img alt="" loading="lazy" src={category.imageUrl} /> : category.icon.trim()}
          </span>
          <strong suppressHydrationWarning>{category.name.trim()}</strong>
        </Link>
      ))}
    </div>
  );
}

export function GeneralProductGrid({
  currency,
  gridId,
  products,
  section,
  storeSlug
}: GeneralProductGridProps) {
  return <ProductGrid currency={currency} gridId={gridId} products={products} section={section} storeSlug={storeSlug} />;
}

export async function GeneralProductSection({
  currency,
  id,
  products,
  section,
  storeSlug
}: {
  currency: string;
  id: string;
  products: StorefrontProduct[];
  section: StorefrontProductSectionSettings;
  storeSlug: string;
}) {
  const basePath = await storefrontBasePath(storeSlug);
  // A product row with nothing in it is a heading over empty space, so the
  // whole section drops out instead of rendering stand-in cards.
  if (products.length === 0) {
    return null;
  }

  // Two sections can now point at the same product source, so the row id comes
  // from the section slot rather than the source it renders.
  const gridId = `general-product-grid-${id}`;

  return (
    <section className="general-home-section general-product-section" id={id} aria-labelledby={`${id}-products-title`}>
      <SectionHeader
        ctaHref={storefrontSectionHref(basePath, section.ctaLink)}
        ctaText={section.ctaText}
        id={`${id}-products-title`}
        sliderTargetId={section.mode === "slider" ? gridId : undefined}
        subtitle={section.subtitle}
        title={section.title}
      />
      <GeneralProductGrid
        currency={currency}
        gridId={gridId}
        products={products}
        section={section}
        storeSlug={storeSlug}
      />
    </section>
  );
}

export async function GeneralPromoBanner({
  imageUrl,
  storeSlug
}: {
  imageUrl?: string | null | undefined;
  storeSlug: string;
}) {
  const basePath = await storefrontBasePath(storeSlug);
  return (
    <section className="general-promo-banner" aria-labelledby="general-promo-title">
      <div className="general-promo-copy">
        <p>The full catalogue</p>
        <h2 id="general-promo-title">Everything in one place</h2>
        <span>Filter by category, price or availability.</span>
        <Link className="general-dark-button general-promo-cta" href={`${basePath}/products`}>
          Browse all products
        </Link>
      </div>
      <div className="general-promo-visual" aria-hidden="true">
        {/* Real catalogue art when the store has any; the CSS shapes are the
            fallback for a store whose products carry no images yet. */}
        {imageUrl ? (
          <img alt="" className="general-promo-visual-image" loading="lazy" src={imageUrl} />
        ) : (
          <div className="general-promo-visual-card">
            <span className="general-promo-visual-stack" />
            <span className="general-promo-visual-leaf" />
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * The homepage's closing band: the catalogue the shopper has just scrolled
 * past, re-offered as one grid they can filter by category without leaving the
 * page.
 *
 * Rendering is skipped outright for a store with nothing to show rather than
 * closing the page on an empty band.
 */
export function GeneralRecommendedForYou({
  categories = [],
  currency,
  enableHoverImage = true,
  products = [],
  title
}: {
  categories?: GeneralCategory[];
  currency: string;
  enableHoverImage?: boolean | undefined;
  products?: StorefrontProduct[];
  title?: string | undefined;
}) {
  const uniqueProducts = Array.from(
    new Map(products.map((product) => [product.id, product])).values()
  );

  if (uniqueProducts.length === 0) {
    return null;
  }

  const clientCategories: GeneralRecommendedCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug
  }));
  const clientProducts: GeneralRecommendedProduct[] = uniqueProducts.map((product) => ({
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug
        }
      : null,
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
    hoverImage:
      enableHoverImage && product.images[1]
        ? {
            alt: product.images[1].alt,
            url: product.images[1].url
          }
        : null,
    id: product.id,
    image: product.images[0]
      ? {
          alt: product.images[0].alt,
          url: product.images[0].url
        }
      : null,
    price: product.price.toString(),
    slug: product.slug,
    title: product.title
  }));

  return (
    <GeneralRecommendedForYouClient
      categories={clientCategories}
      currency={currency}
      products={clientProducts}
      title={title}
    />
  );
}
