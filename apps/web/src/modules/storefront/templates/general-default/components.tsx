import Link from "next/link";
import type { ReactNode } from "react";
import { StorefrontImage } from "../../components/storefront-image";
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
  products: StorefrontProduct[];
  storeSlug: string;
  variant?: "compact" | "standard";
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
  primaryDomain,
  storeName,
  storeSlug,
  subtitle,
  title
}: {
  primaryDomain: string | undefined;
  storeName: string;
  storeSlug: string;
  subtitle?: string | null;
  title?: string | null;
}) {
  return (
    <section className="general-hero" aria-labelledby="general-hero-title">
      <div className="general-hero-copy">
        <p>{primaryDomain ?? `${storeSlug}.dash.com`}</p>
        <h1 id="general-hero-title">{title || "Discover Quality Products for Every Lifestyle"}</h1>
        <span>
          {subtitle || `Shop the latest collection from ${storeName} with reliable delivery and a seamless checkout experience.`}
        </span>
        <Link className="general-dark-button" href={`/s/${storeSlug}/products`}>
          Shop Now
        </Link>
      </div>
      <div className="general-hero-scene" aria-hidden="true">
        <div className="general-hero-window">
          <div className="general-hero-sofa" />
          <div className="general-hero-table" />
          <div className="general-hero-plant" />
          <div className="general-hero-lamp" />
        </div>
      </div>
    </section>
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
  products,
  storeSlug,
  variant = "standard"
}: GeneralProductGridProps) {
  const hasProducts = products.length > 0;
  const cards = hasProducts ? products.slice(0, 4) : demoProducts;

  return (
    <div className={`general-product-grid general-product-grid-${variant}`}>
      {cards.map((product, index) => {
        if ("id" in product) {
          return (
            <Link className="general-product-card" href={`/s/${storeSlug}/products/${product.slug}`} key={product.id}>
              <ProductMedia imageUrl={product.images[0]?.url} label={product.title} />
              <span>{product.category?.name ?? "Product"}</span>
              <strong>{product.title}</strong>
              <p>{formatMoney(product.price, currency)}</p>
            </Link>
          );
        }

        return (
          <Link className="general-product-card" href={`/s/${storeSlug}/products`} key={`${product.title}-${index}`}>
            <ProductMedia label={product.image} />
            {product.badge ? <em>{product.badge}</em> : null}
            <strong>{product.title}</strong>
            <p>{formatMoney(product.price, currency)}</p>
          </Link>
        );
      })}
    </div>
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
  storeSlug
}: {
  currency: string;
  storeSlug: string;
}) {
  return (
    <div className="general-product-grid general-product-grid-compact">
      {recentlyAddedFallback.map((product) => (
        <Link className="general-product-card" href={`/s/${storeSlug}/products`} key={product.title}>
          <ProductMedia label={product.image} />
          <strong>{product.title}</strong>
          <p>{formatMoney(product.price, currency)}</p>
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

function ProductMedia({ imageUrl, label }: { imageUrl?: string | null | undefined; label: string }) {
  return (
    <div className="general-product-media">
      <StorefrontImage alt={label} fallback={label} src={imageUrl} />
    </div>
  );
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
