import Link from "next/link";
import type { ReactNode } from "react";
import { HeroSlider } from "../../components/hero-slider";
import {
  ProductGrid,
  ProductImage,
  ProductPrice,
  SectionHeader
} from "../../components/product-listing";
import type {
  StorefrontAdvancedSettings,
  StorefrontProductSectionSettings
} from "../../customization";
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
  name: string;
  slug: string;
};

const demoCategories = [
  { icon: "Laptop", name: "Electronics", slug: "electronics" },
  { icon: "Sofa", name: "Home & Living", slug: "home-living" },
  { icon: "Jacket", name: "Fashion", slug: "fashion" },
  { icon: "Serum", name: "Beauty", slug: "beauty" },
  { icon: "Toy", name: "Toys", slug: "toys" }
];

const demoProducts = [
  { badge: "New", image: "HP", price: 59, title: "Wireless Headphones" },
  { badge: "Hot", image: "SW", price: 129, title: "Smart Watch" },
  { badge: "Daily", image: "BG", price: 49, title: "Minimal Backpack" },
  { badge: "Deal", image: "CM", price: 89, title: "Coffee Maker" }
];

const collectionCards = [
  {
    count: "30+ Products",
    image: "Modern Living",
    title: "Modern Living"
  },
  {
    count: "25+ Products",
    image: "Summer Essentials",
    title: "Summer Essentials"
  },
  {
    count: "20+ Products",
    image: "Workspace Setup",
    title: "Workspace Setup"
  }
];

const recentlyAddedFallback = [
  { image: "DL", price: 29, title: "Desk Lamp" },
  { image: "WB", price: 19, title: "Water Bottle" },
  { image: "TP", price: 24, title: "Throw Pillow" },
  { image: "YM", price: 39, title: "Yoga Mat" }
];

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

export function GeneralCategoryStrip({
  categories,
  storeSlug
}: {
  categories: GeneralCategory[];
  storeSlug: string;
}) {
  const visibleCategories = categories.length > 0
    ? categories.slice(0, 6).map((category) => ({ icon: category.name.slice(0, 2), name: category.name, slug: category.slug }))
    : demoCategories;

  return (
    <div className="general-category-strip">
      {visibleCategories.map((category) => (
        <Link className="general-category-bubble" href={`/s/${storeSlug}/categories/${category.slug}`} key={category.slug}>
          <span>{category.icon}</span>
          <strong>{category.name}</strong>
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
  const hasProducts = products.length > 0;

  if (hasProducts) {
    return <ProductGrid currency={currency} gridId={gridId} products={products} section={section} storeSlug={storeSlug} />;
  }

  return (
    <div id={gridId} className={`general-product-listing-grid general-product-listing-grid-${section.columns} general-product-listing-${section.mode}`}>
      {demoProducts.slice(0, section.count).map((product, index) => (
        <Link className="general-product-listing-card" href={`/s/${storeSlug}/products`} key={`${product.title}-${index}`}>
          <ProductImage fallback={product.image} alt={product.title} />
          <div className="general-product-listing-meta">
            <div>
              <h3>{product.title}</h3>
              <ProductPrice currency={currency} price={String(product.price)} />
            </div>
            {section.enableBadges && product.badge ? (
              <div className="general-product-listing-flags">
                <em className="general-product-listing-badge">{product.badge.toUpperCase()}</em>
              </div>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

export function GeneralProductSection({
  currency,
  products,
  section,
  storeSlug
}: {
  currency: string;
  products: StorefrontProduct[];
  section: StorefrontProductSectionSettings;
  storeSlug: string;
}) {
  const gridId = `general-product-grid-${section.source}`;

  return (
    <section className="general-home-section general-product-section" aria-labelledby={`${section.source}-products-title`}>
      <SectionHeader
        ctaHref={`/s/${storeSlug}${section.ctaLink.startsWith("/") ? section.ctaLink : `/${section.ctaLink}`}`}
        ctaText={section.ctaText}
        id={`${section.source}-products-title`}
        sliderTargetId={gridId}
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

export function GeneralCollections({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="general-collection-grid">
      {collectionCards.map((collection) => (
        <Link className="general-collection-card" href={`/s/${storeSlug}/products`} key={collection.title}>
          <div aria-hidden="true">{collection.image}</div>
          <strong>{collection.title}</strong>
          <span>{collection.count}</span>
        </Link>
      ))}
    </div>
  );
}

export function GeneralPromoBanner({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="general-promo-banner" aria-labelledby="general-promo-title">
      <div>
        <p>Summer Sale</p>
        <h2 id="general-promo-title">Up to 40% Off</h2>
        <span>Limited time offer on selected items.</span>
        <Link className="general-dark-button" href={`/s/${storeSlug}/products`}>
          Shop Now
        </Link>
      </div>
      <div className="general-promo-visual" aria-hidden="true">
        <div />
        <span />
      </div>
    </section>
  );
}

export function GeneralRecentlyAddedFallback({
  currency,
  section,
  storeSlug
}: {
  currency: string;
  section: StorefrontProductSectionSettings;
  storeSlug: string;
}) {
  return (
    <div className={`general-product-listing-grid general-product-listing-grid-${section.columns} general-product-listing-${section.mode}`}>
      {recentlyAddedFallback.map((product) => (
        <Link className="general-product-listing-card" href={`/s/${storeSlug}/products`} key={product.title}>
          <ProductImage fallback={product.image} alt={product.title} />
          <div className="general-product-listing-meta">
            <div>
              <h3>{product.title}</h3>
              <ProductPrice currency={currency} price={String(product.price)} />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function GeneralNewsletter() {
  return (
    <section className="general-newsletter" aria-labelledby="general-newsletter-title">
      <div>
        <h2 id="general-newsletter-title">Join Our Newsletter</h2>
        <p>Get updates on new arrivals, offers and more.</p>
        <form>
          <input aria-label="Email address" placeholder="Enter your email" type="email" />
          <button type="button">Subscribe</button>
        </form>
      </div>
      <div className="general-newsletter-visual" aria-hidden="true" />
    </section>
  );
}
