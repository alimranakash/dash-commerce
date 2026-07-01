import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPrice } from "../../components/product-card";
import { StorefrontImage } from "../../components/storefront-image";
import type { StorefrontProduct } from "../../storefront.types";

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
  name: string;
  slug: string;
};

const fallbackCategories = [
  { name: "Women", slug: "women" },
  { name: "Men", slug: "men" },
  { name: "Shoes", slug: "shoes" },
  { name: "Accessories", slug: "accessories" }
];

const fallbackProducts = [
  { label: "Linen", price: 89, title: "Linen Overshirt" },
  { label: "Cotton", price: 74, title: "Relaxed Trouser" },
  { label: "Knit", price: 119, title: "Ribbed Knit Dress" },
  { label: "Leather", price: 139, title: "Minimal Crossbody" }
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
  storeName,
  storeSlug,
  subtitle,
  title
}: {
  storeName: string;
  storeSlug: string;
  subtitle?: string | null;
  title?: string | null;
}) {
  return (
    <section className="fashion-hero" aria-labelledby="fashion-hero-title">
      <div className="fashion-hero-image" aria-hidden="true">
        <div className="fashion-model fashion-model-left" />
        <div className="fashion-model fashion-model-right" />
      </div>
      <div className="fashion-hero-copy">
        <p>{storeName}</p>
        <h1 id="fashion-hero-title">{title || "Modern essentials for every season"}</h1>
        <span>{subtitle || "An editorial wardrobe of refined silhouettes, soft layers, and everyday luxury."}</span>
        <Link href={`/s/${storeSlug}/products`}>Shop the Collection</Link>
      </div>
    </section>
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

export function FashionCategoryCards({
  categories,
  storeSlug
}: {
  categories: FashionCategory[];
  storeSlug: string;
}) {
  const visibleCategories = categories.length > 0 ? categories.slice(0, 4) : fallbackCategories;

  return (
    <div className="fashion-category-grid">
      {visibleCategories.map((category, index) => (
        <Link className="fashion-category-card" href={`/s/${storeSlug}/categories/${category.slug}`} key={category.slug}>
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
  const items = products.length > 0 ? products.slice(0, 4) : fallbackProducts;

  return (
    <div className="fashion-product-grid">
      {items.map((product, index) => {
        if ("id" in product) {
          return (
            <FashionProductCard currency={currency} key={product.id} product={product} storeSlug={storeSlug} />
          );
        }

        return (
          <Link className="fashion-product-card fashion-product-card-demo" href={`/s/${storeSlug}/products`} key={`${product.title}-${index}`}>
            <div className="fashion-product-card-media">
              <span>{product.label}</span>
            </div>
            <div className="fashion-product-card-body">
              <h3>{product.title}</h3>
              <p>{formatMoney(product.price, currency)}</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function FashionProductCard({
  currency,
  product,
  storeSlug
}: {
  currency: string;
  product: StorefrontProduct;
  storeSlug: string;
}) {
  const image = product.images[0];
  const isSale = product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price);
  const isUnavailable = product.stockQuantity < 1;

  return (
    <article className="fashion-product-card">
      <Link className="fashion-product-card-media" href={`/s/${storeSlug}/products/${product.slug}`}>
        <StorefrontImage alt={image?.alt ?? product.title} fallback={product.category?.name ?? "Look"} src={image?.url} />
        {isSale ? <strong>Sale</strong> : null}
      </Link>
      <div className="fashion-product-card-body">
        <div>
          {product.category ? <p>{product.category.name}</p> : null}
          <h3>
            <Link href={`/s/${storeSlug}/products/${product.slug}`}>{product.title}</Link>
          </h3>
        </div>
        <ProductPrice
          compareAtPrice={product.compareAtPrice?.toString()}
          currency={currency}
          price={product.price.toString()}
        />
        <form action="/api/cart" method="post">
          <input name="cartAction" type="hidden" value="add" />
          <input name="storeId" type="hidden" value={product.storeId} />
          <input name="storeSlug" type="hidden" value={storeSlug} />
          <input name="productId" type="hidden" value={product.id} />
          <input name="productSlug" type="hidden" value={product.slug} />
          <input name="quantity" type="hidden" value="1" />
          <button disabled={isUnavailable} type="submit">
            {isUnavailable ? "Out of stock" : "Add to cart"}
          </button>
        </form>
      </div>
    </article>
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

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
