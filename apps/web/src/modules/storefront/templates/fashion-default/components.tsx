import { storefrontBasePath } from "../../base-path";
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
  actionLabel?: string | undefined;
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

export async function FashionEditorialCollectionGrid({
  categories,
  ctas,
  storeSlug
}: {
  categories: FashionCategory[];
  ctas?: string[] | undefined;
  storeSlug: string;
}) {
  const basePath = await storefrontBasePath(storeSlug);
  // Cards come from the store's own categories - an empty catalogue renders no
  // section rather than links to collections that were never created.
  const collections = categories.slice(0, 4).map((category, index) => ({
    cta: ctas?.[index] ?? "Shop now",
    imageUrl: category.imageUrl ?? null,
    name: category.name,
    slug: category.slug
  }));

  if (collections.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Shop fashion collections"
      className={collectionStyles.section}
    >
      <div className={collectionStyles.grid}>
        {collections.map((collection, index) => (
          <Link
            className={collectionStyles.card}
            href={`${basePath}/categories/${collection.slug}`}
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

export async function FashionCategoryCards({
  categories,
  storeSlug
}: {
  categories: FashionCategory[];
  storeSlug: string;
}) {
  const basePath = await storefrontBasePath(storeSlug);
  const visibleCategories = categories.slice(0, 4).map((category) => ({
    imageUrl: category.imageUrl ?? null,
    name: category.name,
    slug: category.slug
  }));

  if (visibleCategories.length === 0) {
    return null;
  }

  return (
    <div className="fashion-category-grid">
      {visibleCategories.map((category, index) => (
        <Link className="fashion-category-card" href={`${basePath}/categories/${category.slug}`} key={category.slug}>
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

export async function FashionEditorialBanner({
  ctaLabel,
  ctaLink,
  imageUrl,
  storeSlug,
  subtitle,
  title
}: {
  ctaLabel?: string | null | undefined;
  ctaLink?: string | null | undefined;
  imageUrl?: string | null | undefined;
  storeSlug: string;
  subtitle?: string | null | undefined;
  title?: string | null | undefined;
}) {
  const basePath = await storefrontBasePath(storeSlug);
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
        <Link href={resolveFashionHref(basePath, ctaLink || "/products")}>{ctaLabel?.trim() || "Explore the edit"}</Link>
      </div>
    </section>
  );
}

export async function FashionFeaturedLook({
  ctaLink,
  ctaText,
  description,
  imageUrl,
  products,
  storeSlug,
  title
}: {
  ctaLink?: string | null | undefined;
  ctaText?: string | null | undefined;
  description?: string | null | undefined;
  imageUrl?: string | null | undefined;
  products: StorefrontProduct[];
  storeSlug: string;
  title?: string | null | undefined;
}) {
  const basePath = await storefrontBasePath(storeSlug);
  return (
    <section className={editorialStyles.lookbook} id="fashion-featured-look" aria-labelledby="fashion-lookbook-title">
      <div className={editorialStyles.lookbookMedia}>
        <StorefrontImage alt="" fallback="Featured look" src={imageUrl} />
      </div>
      <div className={editorialStyles.lookbookContent}>
        <p>Featured Look</p>
        <h2 id="fashion-lookbook-title">{title?.trim() || "The art of effortless dressing."}</h2>
        <span>{description?.trim() || "A considered edit of pieces designed to work together, season after season."}</span>
        <Link href={resolveFashionHref(basePath, ctaLink || "/products")}>{ctaText?.trim() || "Shop the look"}</Link>
        <div className={editorialStyles.lookbookProducts}>
          {products.slice(0, 3).map((product) => (
            <Link href={`${basePath}/products/${product.slug}`} key={product.id}>
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
  description,
  images,
  title
}: {
  description?: string | null | undefined;
  images: Array<{ alt: string; url: string | null }>;
  title?: string | null | undefined;
}) {
  // Only real catalogue art is tiled here - a placeholder caption over an empty
  // square reads as a broken image rather than a styling shot.
  const tiles = images.filter((image) => Boolean(image.url)).slice(0, 6);

  if (tiles.length === 0) {
    return null;
  }

  return (
    <section className={editorialStyles.community} aria-labelledby="fashion-community-title">
      <div className={editorialStyles.communityHeading}>
        <div>
          <p>Community</p>
          <h2 id="fashion-community-title">{title?.trim() || "Styled by the community"}</h2>
        </div>
        <span>{description?.trim() || "Real style, worn your way."}</span>
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
  buttonText,
  description,
  imageUrl,
  storeName,
  title
}: {
  buttonText?: string | null | undefined;
  description?: string | null | undefined;
  imageUrl?: string | null | undefined;
  storeName: string;
  title?: string | null | undefined;
}) {
  return (
    <section className={editorialStyles.newsletter} aria-labelledby="fashion-newsletter-title">
      <div className={editorialStyles.newsletterMedia}>
        <StorefrontImage alt="" fallback={storeName} src={imageUrl} />
      </div>
      <div className={editorialStyles.newsletterContent}>
        <p>Private list</p>
        <h2 id="fashion-newsletter-title">{title?.trim() || "Receive the next editorial drop."}</h2>
        <span>{description?.trim() || `New collections, campaign stories, and private offers from ${storeName}.`}</span>
        <form>
          <input aria-label="Email address" placeholder="Email address" type="email" />
          <button type="button">{buttonText?.trim() || "Subscribe"}</button>
        </form>
      </div>
    </section>
  );
}

function resolveFashionHref(basePath: string, href: string) {
  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
    return href;
  }

  if (href === "/") {
    return basePath || "/";
  }

  return `${basePath}${href.startsWith("/") ? href : `/${href}`}`;
}
