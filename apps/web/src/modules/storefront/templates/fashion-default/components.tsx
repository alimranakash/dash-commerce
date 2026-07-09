import Link from "next/link";
import type { ReactNode } from "react";
import { StorefrontImage } from "../../components/storefront-image";
import type { StorefrontAdvancedSettings } from "../../customization";
import type { StorefrontProduct } from "../../storefront.types";
import collectionStyles from "./fashion-collection-grid.module.css";
import editorialStyles from "./fashion-editorial-sections.module.css";
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

export function FashionCollectionCards({
  categories,
  storeSlug
}: {
  categories: FashionCategory[];
  storeSlug: string;
}) {
  const collections = (categories.length > 0 ? categories.slice(0, 3) : fallbackCategories.slice(0, 3));

  return (
    <div className={editorialStyles.collectionGrid}>
      {collections.map((collection, index) => (
        <Link
          className={editorialStyles.collectionCard}
          href={`/s/${storeSlug}/categories/${collection.slug}`}
          key={collection.slug}
        >
          <div className={editorialStyles.collectionMedia}>
            <StorefrontImage
              alt={collection.name}
              fallback={collection.name}
              src={
                "imageUrl" in collection && typeof collection.imageUrl === "string"
                  ? collection.imageUrl
                  : null
              }
            />
          </div>
          <div className={editorialStyles.collectionOverlay} aria-hidden="true" />
          <div className={editorialStyles.collectionContent}>
            <small>{String(index + 1).padStart(2, "0")}</small>
            <h3>{collection.name}</h3>
            <span>Explore collection</span>
          </div>
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

export function FashionEditorialBanner({
  ctaLabel,
  imageUrl,
  storeSlug,
  subtitle,
  title
}: {
  ctaLabel?: string | null | undefined;
  imageUrl?: string | null | undefined;
  storeSlug: string;
  subtitle?: string | null | undefined;
  title?: string | null | undefined;
}) {
  return (
    <section className={editorialStyles.campaign} aria-labelledby="fashion-editorial-title">
      <div className={editorialStyles.campaignMedia}>
        <StorefrontImage
          alt=""
          fallback="Campaign"
          src={imageUrl}
        />
      </div>
      <div className={editorialStyles.campaignContent}>
        <p>Campaign</p>
        <h2 id="fashion-editorial-title">{title?.trim() || "Quiet confidence, cut for everyday movement."}</h2>
        <span>{subtitle?.trim() || "Refined layers, understated textures, and pieces designed to move beautifully together."}</span>
        <Link href={`/s/${storeSlug}/products`}>{ctaLabel?.trim() || "Explore the edit"}</Link>
      </div>
    </section>
  );
}

export function FashionFeaturedLook({
  imageUrl,
  products,
  storeSlug
}: {
  imageUrl?: string | null | undefined;
  products: StorefrontProduct[];
  storeSlug: string;
}) {
  return (
    <section className={editorialStyles.lookbook} aria-labelledby="fashion-lookbook-title">
      <div className={editorialStyles.lookbookMedia}>
        <StorefrontImage alt="" fallback="Featured look" src={imageUrl} />
      </div>
      <div className={editorialStyles.lookbookContent}>
        <p>Featured Look</p>
        <h2 id="fashion-lookbook-title">The art of effortless dressing.</h2>
        <span>A considered edit of pieces designed to work together, season after season.</span>
        <Link href={`/s/${storeSlug}/products`}>Shop the look</Link>
        <div className={editorialStyles.lookbookProducts}>
          {products.slice(0, 3).map((product) => (
            <Link href={`/s/${storeSlug}/products/${product.slug}`} key={product.id}>
              <div>
                <StorefrontImage
                  alt={product.images[0]?.alt ?? product.title}
                  fallback={product.title}
                  src={product.images[0]?.url}
                />
              </div>
              <span>{product.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FashionCommunityGallery({
  images
}: {
  images: Array<{ alt: string; url: string | null }>;
}) {
  const tiles = Array.from({ length: 6 }, (_, index) => (
    images[index] ?? {
      alt: communityTiles[index] ?? "Community style",
      url: null
    }
  ));

  return (
    <section className={editorialStyles.community} aria-labelledby="fashion-community-title">
      <div className={editorialStyles.communityHeading}>
        <div>
          <p>Community</p>
          <h2 id="fashion-community-title">Styled by the community</h2>
        </div>
        <span>Real style, worn your way.</span>
      </div>
      <div className={editorialStyles.communityGrid}>
        {tiles.map((tile, index) => (
          <figure key={`${tile.alt}-${index}`}>
            <StorefrontImage alt={tile.alt} fallback={tile.alt} src={tile.url} />
            <figcaption>{tile.alt}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

export function FashionNewsletter({
  imageUrl,
  storeName
}: {
  imageUrl?: string | null | undefined;
  storeName: string;
}) {
  return (
    <section className={editorialStyles.newsletter} aria-labelledby="fashion-newsletter-title">
      <div className={editorialStyles.newsletterMedia}>
        <StorefrontImage alt="" fallback={storeName} src={imageUrl} />
      </div>
      <div className={editorialStyles.newsletterContent}>
        <p>Private list</p>
        <h2 id="fashion-newsletter-title">Receive the next editorial drop.</h2>
        <span>New collections, campaign stories, and private offers from {storeName}.</span>
        <form>
          <input aria-label="Email address" placeholder="Email address" type="email" />
          <button type="button">Subscribe</button>
        </form>
      </div>
    </section>
  );
}
