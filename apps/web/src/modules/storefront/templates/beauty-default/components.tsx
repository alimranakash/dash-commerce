import Link from "next/link";
import type { ReactNode } from "react";
import {
  ProductGrid,
  ProductImage,
  ProductPrice as ListingProductPrice,
  SectionHeader
} from "../../components/product-listing";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontAdvancedSettings,
  type StorefrontProductSectionSettings
} from "../../customization";
import type { StorefrontProduct } from "../../storefront.types";
import { FashionHeroSlider } from "../fashion-default/fashion-hero-slider";
import { BEAUTY_PRODUCT_CARD_VARIANT, BeautyListingCard } from "./beauty-listing-card";

type BeautySectionProps = {
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  eyebrow?: string;
  id: string;
  title: string;
};

type BeautyCategory = {
  id: string;
  imageUrl?: string | null;
  name: string;
  slug: string;
};

const fallbackCategories = [
  { name: "Skincare", slug: "skincare" },
  { name: "Makeup", slug: "makeup" },
  { name: "Hair Care", slug: "hair-care" },
  { name: "Fragrance", slug: "fragrance" },
  { name: "Body Care", slug: "body-care" }
];

const concernCards = ["Dry Skin", "Oily Skin", "Sensitive Skin", "Anti-Aging", "Acne Care"];

const fallbackProducts = [
  { brand: "Luma", label: "Glow", price: 42, title: "Hydrating Face Serum" },
  { brand: "Rose", label: "Tint", price: 28, title: "Soft Matte Lip Tint" },
  { brand: "Aura", label: "SPF", price: 36, title: "Daily Mineral SPF" },
  { brand: "Nude", label: "Mist", price: 24, title: "Calming Beauty Mist" },
  { brand: "Silk", label: "Mask", price: 34, title: "Restorative Hair Mask" }
];

const beautyTips = [
  ["Daily Skincare Routine", "Cleanse, hydrate, protect, and repeat with products that suit your skin."],
  ["Beauty Tips", "Layer formulas gently and let each step absorb before the next."],
  ["Makeup Guide", "Choose soft tones, build coverage gradually, and finish with a natural glow."]
];

const reviews = [
  ["A", "The texture feels luxurious and my routine finally feels simple."],
  ["M", "Beautiful packaging, gentle formulas, and fast delivery."],
  ["S", "My skin feels calmer. I love the curated product selection."]
];

export function BeautySection({
  actionHref,
  actionLabel = "View all",
  children,
  eyebrow,
  id,
  title
}: BeautySectionProps) {
  return (
    <section className="beauty-home-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="beauty-section-heading">
        <div>
          {eyebrow ? <p>{eyebrow}</p> : null}
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
        {actionHref ? <Link href={actionHref}>{actionLabel}</Link> : null}
      </div>
      {children}
    </section>
  );
}

// Beauty Default reuses the Fashion Default hero slider so both templates share the
// same full-bleed media/overlay/dots implementation. The eyebrow slot is a short
// label by design — the long `heroSubtitle` paragraph has no place in this layout.
const beautyHeroEyebrow = "BEAUTY ESSENTIALS";
const beautyHeroTitle = "Soft rituals for\nradiant everyday beauty";

export function BeautyHero({
  advancedSettings,
  heroImageUrl,
  storeName,
  storeSlug,
  title
}: {
  advancedSettings?: StorefrontAdvancedSettings | null | undefined;
  heroImageUrl?: string | null | undefined;
  storeName: string;
  storeSlug: string;
  title?: string | null;
}) {
  void storeName;

  const heroSubtitle = advancedSettings?.hero.subtitle;
  // The shipped default is a general-store sentence; only a seller-authored value
  // belongs in the eyebrow, otherwise beauty falls back to its own short label.
  const eyebrow = heroSubtitle && heroSubtitle !== DEFAULT_STOREFRONT_ADVANCED_SETTINGS.hero.subtitle
    ? heroSubtitle
    : beautyHeroEyebrow;

  return (
    <FashionHeroSlider
      fallbackImageUrl={heroImageUrl}
      settings={advancedSettings}
      storeSlug={storeSlug}
      subtitle={eyebrow}
      title={title || beautyHeroTitle}
    />
  );
}

export function BeautyCategoryGrid({
  categories,
  storeSlug
}: {
  categories: BeautyCategory[];
  storeSlug: string;
}) {
  const visibleCategories = (categories.length > 0 ? categories.slice(0, 5) : fallbackCategories).map((category) => ({
    imageUrl: "imageUrl" in category && typeof category.imageUrl === "string" ? category.imageUrl : null,
    name: category.name,
    slug: category.slug
  }));

  return (
    <div className="beauty-category-grid">
      {visibleCategories.map((category, index) => (
        <Link className="beauty-category-card" href={`/s/${storeSlug}/categories/${category.slug}`} key={category.slug}>
          {category.imageUrl ? <img alt="" loading="lazy" src={category.imageUrl} /> : null}
          <span>{String(index + 1).padStart(2, "0")}</span>
          <strong>{category.name}</strong>
        </Link>
      ))}
    </div>
  );
}

// The homepage product rows are the General Default rows: same shared `SectionHeader`
// (title / subtitle / CTA / slider arrows) above the same `ProductGrid`, so the cards,
// the 5-per-view sizing, and the arrow behaviour are identical across both templates.
export function BeautyProductSection({
  currency,
  id,
  products,
  section,
  storeId,
  storeSlug
}: {
  currency: string;
  id: string;
  products: StorefrontProduct[];
  section: StorefrontProductSectionSettings;
  storeId: string;
  storeSlug: string;
}) {
  const gridId = `${id}-grid`;

  return (
    <section className="general-home-section general-product-section" id={id} aria-labelledby={`${id}-title`}>
      <SectionHeader
        ctaHref={`/s/${storeSlug}${section.ctaLink.startsWith("/") ? section.ctaLink : `/${section.ctaLink}`}`}
        ctaText={section.ctaText}
        id={`${id}-title`}
        sliderTargetId={section.mode === "slider" ? gridId : undefined}
        subtitle={section.subtitle}
        title={section.title}
      />
      <BeautyProductGrid
        currency={currency}
        gridId={gridId}
        products={products}
        section={section}
        storeId={storeId}
        storeSlug={storeSlug}
      />
    </section>
  );
}

export function BeautyProductGrid({
  currency,
  gridId,
  products,
  section,
  storeId,
  storeSlug
}: {
  currency: string;
  gridId?: string;
  products: StorefrontProduct[];
  section: StorefrontProductSectionSettings;
  storeId: string;
  storeSlug: string;
}) {
  if (products.length > 0) {
    return (
      <ProductGrid
        cardVariant={BEAUTY_PRODUCT_CARD_VARIANT}
        currency={currency}
        gridId={gridId}
        products={products}
        section={section}
        storeId={storeId}
        storeSlug={storeSlug}
      />
    );
  }

  return (
    <div id={gridId} className={`general-product-listing-grid general-product-listing-grid-${section.columns} general-product-listing-${section.mode}`}>
      {fallbackProducts.slice(0, section.count).map((product, index) => (
        <Link className="general-product-listing-card" href={`/s/${storeSlug}/products`} key={`${product.title}-${index}`}>
          <ProductImage alt={product.title} fallback={product.label} />
          <div className="general-product-listing-meta">
            <div>
              <h3>{product.title}</h3>
              <ListingProductPrice currency={currency} price={String(product.price)} />
            </div>
            {section.enableBadges ? (
              <div className="general-product-listing-flags">
                <em className="general-product-listing-badge">{product.brand.toUpperCase()}</em>
              </div>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  );
}

// The template config's card slot renders the same card the grids do, so a single
// implementation covers every place a Beauty Default product appears.
export function BeautyProductCard({
  currency,
  product,
  storeSlug
}: {
  currency: string;
  product: StorefrontProduct;
  storeSlug: string;
}) {
  return (
    <BeautyListingCard
      currency={currency}
      product={product}
      section={DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.listing}
      storeId={product.storeId}
      storeSlug={storeSlug}
    />
  );
}

export function BeautyConcernGrid({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="beauty-concern-grid">
      {concernCards.map((concern) => (
        <Link href={`/s/${storeSlug}/products`} key={concern}>
          {concern}
        </Link>
      ))}
    </div>
  );
}

// Shared heading for the full-width bands, so the eyebrow/title pairing keeps one
// typographic hierarchy across the guide, reviews, story, and newsletter sections.
function BeautyBandHeading({
  align = "start",
  eyebrow,
  id,
  title
}: {
  align?: "center" | "start";
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <div className={`beauty-band-heading beauty-band-heading-${align}`}>
      <p>{eyebrow}</p>
      <h2 id={id}>{title}</h2>
    </div>
  );
}

export function BeautyTipsGuide() {
  return (
    <section className="beauty-band beauty-guide" aria-labelledby="beauty-guide-title">
      <BeautyBandHeading
        eyebrow="Beauty Tips"
        id="beauty-guide-title"
        title="Guides for rituals, shades, and skin confidence."
      />
      <div className="beauty-guide-grid">
        {beautyTips.map(([title, text]) => (
          <article key={title}>
            <span aria-hidden="true" />
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BeautyReviews() {
  return (
    <section className="beauty-band beauty-reviews" aria-labelledby="beauty-reviews-title">
      <BeautyBandHeading
        align="center"
        eyebrow="Customer Reviews"
        id="beauty-reviews-title"
        title="Loved by beauty shoppers"
      />
      <div className="beauty-reviews-grid">
        {reviews.map(([initial, text]) => (
          <article key={text}>
            <p>"{text}"</p>
            <footer>
              <span aria-hidden="true">{initial}</span>
              <strong>Verified customer</strong>
            </footer>
          </article>
        ))}
      </div>
    </section>
  );
}

export function BeautyBrandStory({ storeName, storeSlug }: { storeName: string; storeSlug: string }) {
  return (
    <section className="beauty-band beauty-story" aria-labelledby="beauty-story-title">
      <div className="beauty-story-image" aria-hidden="true" />
      <div className="beauty-story-copy">
        <p>Brand Story</p>
        <h2 id="beauty-story-title">A softer way to discover beauty.</h2>
        <span>
          {storeName} brings together thoughtful products, gentle rituals, and a polished shopping experience for customers who value trust and elegance.
        </span>
        <Link href={`/s/${storeSlug}/products`}>Explore products</Link>
      </div>
    </section>
  );
}

export function BeautyNewsletter() {
  return (
    <section className="beauty-band beauty-newsletter" aria-labelledby="beauty-newsletter-title">
      <div className="beauty-newsletter-inner">
        <p>Newsletter</p>
        <h2 id="beauty-newsletter-title">Receive beauty rituals and new launches.</h2>
        <form>
          <input aria-label="Email address" placeholder="Email address" type="email" />
          <button type="button">Subscribe</button>
        </form>
      </div>
    </section>
  );
}
