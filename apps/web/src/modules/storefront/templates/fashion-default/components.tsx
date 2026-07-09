import Link from "next/link";
import type { ReactNode } from "react";
import { StorefrontImage } from "../../components/storefront-image";
import type { StorefrontAdvancedSettings } from "../../customization";
import type { StorefrontProduct } from "../../storefront.types";
import collectionStyles from "./fashion-collection-grid.module.css";
import { FashionEditorialProductCard } from "./fashion-editorial-product-card";
import { FashionHeroSlider } from "./fashion-hero-slider";
import { toFashionProductCardData } from "./fashion-product-card-data";

type FashionSectionProps = {
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  eyebrow?: string;
  id: string;
  title: string;
};

type FashionCategory = {
  id: string;
  imageUrl?: string | null;
  name: string;
  slug: string;
};

const fallbackCategories = [
  { name: "Women", slug: "women" },
  { name: "Men", slug: "men" },
  { name: "Shoes", slug: "shoes" },
  { name: "Accessories", slug: "accessories" }
];

const fallbackEditorialCollections = [
  { cta: "Shop now", name: "Bikinis", slug: "bikinis" },
  { cta: "One pieces", name: "One Pieces", slug: "one-pieces" },
  { cta: "Swim tops", name: "Swim Tops", slug: "swim-tops" },
  { cta: "Shop cover-ups", name: "Beachwear", slug: "beachwear" }
];

const featuredCollections = [
  { label: "01", subtitle: "Airy silhouettes for warm days", title: "Summer Collection" },
  { label: "02", subtitle: "New textures, clean proportions", title: "New Arrivals" },
  { label: "03", subtitle: "Everyday pieces with quiet polish", title: "Essentials" }
];

const communityTiles = ["Street Edit", "Neutral Layers", "Weekend Set", "Soft Tailoring", "City Walk", "Evening Ease"];

export function FashionSection({
  actionHref,
  actionLabel = "View all",
  children,
  eyebrow,
  id,
  title
}: FashionSectionProps) {
  return (
    <section className="fashion-home-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="fashion-section-heading">
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

export function FashionHero({
  advancedSettings,
  heroImageUrl,
  storeName,
  storeSlug,
  subtitle,
  title
}: {
  advancedSettings?: StorefrontAdvancedSettings | null | undefined;
  heroImageUrl?: string | null | undefined;
  storeName: string;
  storeSlug: string;
  subtitle?: string | null;
  title?: string | null;
}) {
  void storeName;

  return (
    <FashionHeroSlider
      fallbackImageUrl={heroImageUrl}
      settings={advancedSettings}
      storeSlug={storeSlug}
      subtitle={subtitle || "THAT FEEL GOOD FIT"}
      title={title || "Iconic style,\nmaximum heat."}
    />
  );
}

export function FashionCollectionCards({ storeSlug }: { storeSlug: string }) {
  return (
    <div className="fashion-collection-grid">
      {featuredCollections.map((collection) => (
        <Link className="fashion-collection-card" href={`/s/${storeSlug}/products`} key={collection.title}>
          <div aria-hidden="true">{collection.label}</div>
          <span>{collection.subtitle}</span>
          <strong>{collection.title}</strong>
        </Link>
      ))}
    </div>
  );
}

export function FashionEditorialCollectionGrid({
  categories,
  storeSlug
}: {
  categories: FashionCategory[];
  storeSlug: string;
}) {
  const collections = (categories.length > 0 ? categories.slice(0, 4) : fallbackEditorialCollections).map(
    (category, index) => ({
      cta:
        "cta" in category && typeof category.cta === "string"
          ? category.cta
          : fallbackEditorialCollections[index]?.cta ?? "Shop now",
      imageUrl:
        "imageUrl" in category && typeof category.imageUrl === "string"
          ? category.imageUrl
          : null,
      name: category.name,
      slug: category.slug
    })
  );

  return (
    <section
      aria-label="Shop fashion collections"
      className={collectionStyles.section}
    >
      <div className={collectionStyles.grid}>
        {collections.map((collection, index) => (
          <Link
            className={collectionStyles.card}
            href={`/s/${storeSlug}/categories/${collection.slug}`}
            key={collection.slug}
          >
            <div className={collectionStyles.media}>
              <StorefrontImage
                alt={collection.name}
                fallback={collection.name}
                src={collection.imageUrl}
              />
            </div>
            <div className={collectionStyles.shade} aria-hidden="true" />
            <div className={collectionStyles.content}>
              <h2>{collection.name}</h2>
              <span>{collection.cta}</span>
            </div>
            <span className="sr-only">Collection {index + 1} of {collections.length}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function FashionCategoryCards({
  categories,
  storeSlug
}: {
  categories: FashionCategory[];
  storeSlug: string;
}) {
  const visibleCategories = (categories.length > 0 ? categories.slice(0, 4) : fallbackCategories).map((category) => ({
    imageUrl: "imageUrl" in category && typeof category.imageUrl === "string" ? category.imageUrl : null,
    name: category.name,
    slug: category.slug
  }));

  return (
    <div className="fashion-category-grid">
      {visibleCategories.map((category, index) => (
        <Link className="fashion-category-card" href={`/s/${storeSlug}/categories/${category.slug}`} key={category.slug}>
          {category.imageUrl ? <img alt="" loading="lazy" src={category.imageUrl} /> : null}
          <div aria-hidden="true">{String(index + 1).padStart(2, "0")}</div>
          <strong>{category.name}</strong>
        </Link>
      ))}
    </div>
  );
}

export function FashionProductGrid({
  currency,
  products,
  storeSlug
}: {
  currency: string;
  products: StorefrontProduct[];
  storeSlug: string;
}) {
  return (
    <div className="fashion-product-grid">
      {products.length > 0 ? (
        products.slice(0, 4).map((product) => (
          <FashionEditorialProductCard
            currency={currency}
            key={product.id}
            product={toFashionProductCardData(product)}
            storeSlug={storeSlug}
          />
        ))
      ) : (
        <p className="fashion-product-grid-empty">Products will appear here when they are published.</p>
      )}
    </div>
  );
}

export function FashionEditorialBanner({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="fashion-editorial" aria-labelledby="fashion-editorial-title">
      <div className="fashion-editorial-image" aria-hidden="true" />
      <div>
        <p>Campaign</p>
        <h2 id="fashion-editorial-title">Quiet confidence, cut for everyday movement.</h2>
        <span>Explore refined layers, understated textures, and pieces made to work beautifully together.</span>
        <Link href={`/s/${storeSlug}/products`}>Explore the edit</Link>
      </div>
    </section>
  );
}

export function FashionFeaturedLook({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="fashion-lookbook" aria-labelledby="fashion-lookbook-title">
      <div>
        <p>Featured Look</p>
        <h2 id="fashion-lookbook-title">A complete outfit for the modern day.</h2>
        <span>Curate jacket, knitwear, trousers, footwear, and accessories into one editorial shopping moment.</span>
        <Link href={`/s/${storeSlug}/products`}>Shop the look</Link>
      </div>
      <div className="fashion-lookbook-grid" aria-hidden="true">
        <span>Coat</span>
        <span>Knit</span>
        <span>Bag</span>
      </div>
    </section>
  );
}

export function FashionCommunityGallery() {
  return (
    <section className="fashion-home-section" aria-labelledby="fashion-community-title">
      <div className="fashion-section-heading">
        <div>
          <p>Community</p>
          <h2 id="fashion-community-title">Styled by the community</h2>
        </div>
      </div>
      <div className="fashion-community-grid">
        {communityTiles.map((tile) => (
          <div key={tile}>{tile}</div>
        ))}
      </div>
    </section>
  );
}

export function FashionNewsletter() {
  return (
    <section className="fashion-newsletter" aria-labelledby="fashion-newsletter-title">
      <p>Newsletter</p>
      <h2 id="fashion-newsletter-title">Receive the next editorial drop.</h2>
      <form>
        <input aria-label="Email address" placeholder="Email address" type="email" />
        <button type="button">Subscribe</button>
      </form>
    </section>
  );
}
