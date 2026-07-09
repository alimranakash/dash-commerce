import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPrice } from "../../components/product-card";
import { StorefrontImage } from "../../components/storefront-image";
import type { StorefrontProduct } from "../../storefront.types";
import type { StorefrontAdvancedSettings } from "../../customization";
import { ElectronicsCategoryCarousel, type ElectronicsCarouselItem } from "./electronics-category-carousel";
import styles from "./electronics-hero.module.css";

type ElectronicsSectionProps = {
  actionHref?: string;
  actionLabel?: string;
  children: ReactNode;
  eyebrow?: string;
  id: string;
  title: string;
};

type ElectronicsCategory = {
  id: string;
  imageUrl?: string | null;
  name: string;
  slug: string;
};

const fallbackCategories = [
  { icon: "SW", name: "Smart Watches", slug: "smart-watches" },
  { icon: "CA", name: "Cases", slug: "cases" },
  { icon: "SP", name: "Speakers", slug: "speakers" },
  { icon: "TB", name: "Tablets", slug: "tablets" },
  { icon: "LP", name: "Laptops", slug: "laptops" },
  { icon: "EB", name: "Earbuds", slug: "earbuds" }
];

const brandCards = ["Apple", "Samsung", "Sony", "DJI", "Logitech", "Nothing"];

const fallbackProducts = [
  { brand: "Aero", label: "XR", price: 899, title: "AeroPhone XR" },
  { brand: "Nova", label: "NB", price: 1299, title: "NovaBook Pro" },
  { brand: "Pulse", label: "HD", price: 199, title: "Pulse Headphones" },
  { brand: "Orbit", label: "DR", price: 749, title: "Orbit Mini Drone" },
  { brand: "Core", label: "KB", price: 159, title: "Core Mechanical Keyboard" }
];

export function ElectronicsSection({
  actionHref,
  actionLabel = "View all",
  children,
  eyebrow,
  id,
  title
}: ElectronicsSectionProps) {
  return (
    <section className="electronics-home-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="electronics-section-inner">
        <div className="electronics-section-heading">
          <div>
            {eyebrow ? <p>{eyebrow}</p> : null}
            <h2 id={`${id}-title`}>{title}</h2>
          </div>
          {actionHref ? <Link href={actionHref}>{actionLabel}</Link> : null}
        </div>
        {children}
      </div>
    </section>
  );
}

export function ElectronicsHero({
  categories,
  heroSettings,
  products,
  storeSlug,
  subtitle,
  title
}: {
  categories: ElectronicsCategory[];
  heroSettings: StorefrontAdvancedSettings["hero"] | undefined;
  products: StorefrontProduct[];
  storeSlug: string;
  subtitle?: string | null;
  title?: string | null;
}) {
  const productImages = products
    .flatMap((product) => product.images.map((image) => image.url))
    .filter((url): url is string => Boolean(url));
  const categoryImages = categories
    .map((category) => category.imageUrl)
    .filter((url): url is string => Boolean(url));
  const heroImage = heroSettings?.imageUrl || heroSettings?.slides[0]?.url || productImages[0] || categoryImages[0];
  const gamingImage = productImages[1] || categoryImages.find((url) => /gaming/i.test(url)) || productImages[0] || heroImage;
  const headphonesImage = productImages[2] || categoryImages.find((url) => /audio|headphone/i.test(url)) || productImages[1] || heroImage;
  const watchImage = productImages[3] || categoryImages.find((url) => /watch/i.test(url)) || productImages[2] || heroImage;

  return (
    <section className={styles.section} aria-labelledby="electronics-hero-title">
      <div className={styles.grid}>
        <article className={`${styles.card} ${styles.mainCard}`}>
          <div className={styles.mainCopy}>
            <span className={styles.status}>In stock now</span>
            <h1 id="electronics-hero-title">{title || "High-Output Mobile Devices"}</h1>
            <p>{subtitle || "Find your perfect phone - sleek and stylish or budget-friendly."}</p>
            <Link className={styles.cta} href={`/s/${storeSlug}/products`}>
              {heroSettings?.button1Text || "Shop Now"}
            </Link>
          </div>
          <div className={styles.mainMedia}>
            <StorefrontImage alt="" fallback="Mobile" loading="eager" src={heroImage} />
          </div>
        </article>

        <PromoCard
          badge="Gaming"
          className={`${styles.middleCard} ${styles.promoCardTall}`}
          fallback="Gaming"
          imageUrl={gamingImage}
          title="Find ideal gaming consoles"
        />

        <div className={styles.rightColumn}>
          <PromoCard
            badge="Headphones"
            className={styles.headphoneCard}
            fallback="Audio"
            imageUrl={headphonesImage}
            title="High-quality sound"
          />
          <PromoCard
            badge="Smart Watches"
            className={styles.watchCard}
            fallback="Watch"
            imageUrl={watchImage}
            title="Smart features, long battery life"
          />
        </div>
      </div>
    </section>
  );
}

function PromoCard({
  badge,
  className,
  fallback,
  imageUrl,
  title
}: {
  badge: string;
  className: string | undefined;
  fallback: string;
  imageUrl: string | null | undefined;
  title: string;
}) {
  return (
    <article className={`${styles.card} ${styles.promoCard} ${className ?? ""}`}>
      <div className={styles.promoMedia}>
        <StorefrontImage alt="" fallback={fallback} src={imageUrl} />
      </div>
      <div className={styles.promoText}>
        <span className={styles.badge}>{badge}</span>
        <h2>{title}</h2>
      </div>
    </article>
  );
}

export function ElectronicsCategoryGrid({
  categories,
  products = [],
  storeSlug
}: {
  categories: ElectronicsCategory[];
  products?: StorefrontProduct[];
  storeSlug: string;
}) {
  const items: ElectronicsCarouselItem[] = categories.length > 0
    ? categories.slice(0, 12).map((category) => ({
      fallback: category.name.trim().slice(0, 2).toUpperCase(),
      href: `/s/${storeSlug}/categories/${category.slug}`,
      imageUrl: category.imageUrl ?? productImageForCategory(products, category),
      label: category.name.trim()
    }))
    : fallbackCategories.map((category, index) => ({
      fallback: category.icon,
      href: `/s/${storeSlug}/products?search=${encodeURIComponent(category.name)}`,
      imageUrl: products[index]?.images[0]?.url ?? null,
      label: category.name
    }));

  return <ElectronicsCategoryCarousel items={items} />;
}

export function ElectronicsBrandGrid({
  products = [],
  storeSlug
}: {
  products?: StorefrontProduct[];
  storeSlug: string;
}) {
  const items = brandCards.map((brand, index) => ({
    fallback: brand.slice(0, 2).toUpperCase(),
    href: `/s/${storeSlug}/products?search=${encodeURIComponent(brand)}`,
    imageUrl: products[index]?.images[0]?.url ?? null,
    label: brand
  }));

  return <ElectronicsCategoryCarousel items={items} />;
}

function productImageForCategory(products: StorefrontProduct[], category: ElectronicsCategory) {
  const matchedProduct = products.find((product) =>
    product.categoryId === category.id ||
    product.category?.slug === category.slug ||
    product.category?.name?.toLowerCase() === category.name.toLowerCase()
  );

  return matchedProduct?.images[0]?.url ?? null;
}

export function ElectronicsProductGrid({
  currency,
  products,
  storeSlug,
  variant = "standard"
}: {
  currency: string;
  products: StorefrontProduct[];
  storeSlug: string;
  variant?: "deal" | "standard";
}) {
  const items = products.length > 0 ? products.slice(0, 5) : fallbackProducts;

  return (
    <div className={`electronics-product-grid electronics-product-grid-${variant}`}>
      {items.map((product, index) => {
        if ("id" in product) {
          return (
            <ElectronicsProductCard currency={currency} key={product.id} product={product} storeSlug={storeSlug} variant={variant} />
          );
        }

        return (
          <Link className="electronics-product-card electronics-product-card-demo" href={`/s/${storeSlug}/products`} key={`${product.title}-${index}`}>
            <div className="electronics-product-card-media">
              <span>{product.label}</span>
              {variant === "deal" ? <strong>Save 20%</strong> : null}
            </div>
            <div className="electronics-product-card-body">
              <p>{product.brand}</p>
              <h3>{product.title}</h3>
              <p className="electronics-rating">★★★★★ 4.8</p>
              <ProductPrice currency={currency} price={String(product.price)} />
              <small>1 year warranty</small>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function ElectronicsProductCard({
  currency,
  product,
  storeSlug,
  variant = "standard"
}: {
  currency: string;
  product: StorefrontProduct;
  storeSlug: string;
  variant?: "deal" | "standard";
}) {
  const image = product.images[0];
  const isSale = product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price);
  const isUnavailable = product.stockQuantity < 1;

  return (
    <article className="electronics-product-card">
      <Link className="electronics-product-card-media" href={`/s/${storeSlug}/products/${product.slug}`}>
        <StorefrontImage alt={image?.alt ?? product.title} fallback={product.category?.name?.slice(0, 2).toUpperCase() ?? "TX"} src={image?.url} />
        {isSale || variant === "deal" ? <strong>{variant === "deal" ? "Flash Deal" : "Deal"}</strong> : null}
      </Link>
      <div className="electronics-product-card-body">
        <p>{product.category?.name ?? "Store Verified"}</p>
        <h3>
          <Link href={`/s/${storeSlug}/products/${product.slug}`}>{product.title}</Link>
        </h3>
        <p className="electronics-rating">★★★★★ 4.8</p>
        <ProductPrice
          compareAtPrice={product.compareAtPrice?.toString()}
          currency={currency}
          price={product.price.toString()}
        />
        <small>{product.stockQuantity > 0 ? "Official warranty included" : "Out of stock"}</small>
        <form action="/api/cart" method="post">
          <input name="cartAction" type="hidden" value="add" />
          <input name="storeId" type="hidden" value={product.storeId} />
          <input name="storeSlug" type="hidden" value={storeSlug} />
          <input name="productId" type="hidden" value={product.id} />
          <input name="productSlug" type="hidden" value={product.slug} />
          <input name="quantity" type="hidden" value="1" />
          <button disabled={isUnavailable} type="submit">
            {isUnavailable ? "Unavailable" : "Add to cart"}
          </button>
        </form>
      </div>
    </article>
  );
}

export function ElectronicsFlashDeals({
  currency,
  products,
  storeSlug
}: {
  currency: string;
  products: StorefrontProduct[];
  storeSlug: string;
}) {
  return (
    <section className="electronics-flash-deals" aria-labelledby="electronics-flash-title">
      <div className="electronics-flash-header">
        <div>
          <p>Flash Deals</p>
          <h2 id="electronics-flash-title">Limited-time tech offers</h2>
        </div>
        <div aria-label="Countdown placeholder">
          <span>02</span>
          <span>18</span>
          <span>44</span>
        </div>
      </div>
      <ElectronicsProductGrid currency={currency} products={products} storeSlug={storeSlug} variant="deal" />
    </section>
  );
}

export function ElectronicsTechnologyBanner({
  products = [],
  storeSlug
}: {
  products?: StorefrontProduct[];
  storeSlug: string;
}) {
  const promoCards = [
    {
      badge: "45% OFF",
      className: "electronics-promo-card-cooker",
      description: "Let technology do the cooking - now 45% off!",
      fallback: "EC",
      imageUrl: products[0]?.images[0]?.url,
      title: "Electric Cooker"
    },
    {
      badge: "35% OFF",
      className: "electronics-promo-card-coffee",
      description: "Experience bold flavor - 35% off today!",
      fallback: "CM",
      imageUrl: products[1]?.images[0]?.url,
      title: "Coffee Machines"
    },
    {
      className: "electronics-promo-card-display",
      fallback: "TV",
      imageUrl: products[2]?.images[0]?.url,
      title: "TV & Display"
    },
    {
      className: "electronics-promo-card-fryer",
      fallback: "AF",
      imageUrl: products[3]?.images[0]?.url,
      title: "Air Fryers"
    },
    {
      className: "electronics-promo-card-humidifier",
      description: "Breathe easier and sleep better with cleaner, fresher air.",
      fallback: "HU",
      imageUrl: products[4]?.images[0]?.url,
      title: "Humidifier"
    }
  ];

  return (
    <section className="electronics-promo-deals" aria-labelledby="electronics-promo-title">
      <h2 id="electronics-promo-title">Urgent Sale - Home Essentials You&apos;ll Love!</h2>
      <div className="electronics-promo-grid">
        {promoCards.map((card) => (
          <article className={`electronics-promo-card ${card.className}`} key={card.title}>
            {card.badge ? <PromoBadge label={card.badge} /> : null}
            <div className="electronics-promo-image">
              <StorefrontImage alt="" fallback={card.fallback} src={card.imageUrl} />
            </div>
            <div className="electronics-promo-copy">
              <h3>{card.title}</h3>
              {card.description ? <p>{card.description}</p> : null}
              <Link href={`/s/${storeSlug}/products?search=${encodeURIComponent(card.title)}`}>Shop now</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ElectronicsRecommendedForYou({
  currency,
  products = [],
  storeSlug
}: {
  currency: string;
  products?: StorefrontProduct[];
  storeSlug: string;
}) {
  const tabs = ["All", "Gaming", "Laptops", "Phones", "Smart Watches", "Speakers"];
  const items = products.length > 0 ? products.slice(0, 12) : fallbackProducts;

  return (
    <section className="electronics-recommended" aria-labelledby="electronics-recommended-title">
      <div className="electronics-recommended-inner">
        <h2 id="electronics-recommended-title">Recommended for You</h2>
        <div className="electronics-recommended-tabs" role="tablist" aria-label="Recommended product categories">
          {tabs.map((tab, index) => (
            <button aria-selected={index === 0} className={index === 0 ? "is-active" : undefined} key={tab} role="tab" type="button">
              {tab}
            </button>
          ))}
        </div>
        <div className="electronics-recommended-grid">
          {items.map((product, index) => {
            if ("id" in product) {
              return (
                <ElectronicsRecommendedProductCard
                  currency={currency}
                  key={`${product.id}-${index}`}
                  product={product}
                  storeSlug={storeSlug}
                />
              );
            }

            return (
              <Link className="electronics-recommended-card" href={`/s/${storeSlug}/products`} key={`${product.title}-${index}`}>
                <span className="electronics-recommended-media">{product.label}</span>
                <span className="electronics-recommended-info">
                  <small>{product.brand}</small>
                  <strong>{product.title}</strong>
                </span>
                <ProductPrice currency={currency} price={String(product.price)} />
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function ElectronicsRecommendedProductCard({
  currency,
  product,
  storeSlug
}: {
  currency: string;
  product: StorefrontProduct;
  storeSlug: string;
}) {
  const image = product.images[0];

  return (
    <Link className="electronics-recommended-card" href={`/s/${storeSlug}/products/${product.slug}`}>
      <span className="electronics-recommended-media">
        <StorefrontImage alt={image?.alt ?? product.title} fallback={product.category?.name?.slice(0, 2).toUpperCase() ?? "TX"} src={image?.url} />
      </span>
      <span className="electronics-recommended-info">
        <small>{product.category?.name ?? "Stockmart"}</small>
        <strong>{product.title}</strong>
      </span>
      <ProductPrice
        compareAtPrice={product.compareAtPrice?.toString()}
        currency={currency}
        price={product.price.toString()}
      />
    </Link>
  );
}

function PromoBadge({ label }: { label: string }) {
  const [value, suffix = "OFF"] = label.split(" ");

  return (
    <span className="electronics-promo-badge">
      <strong>{value}</strong>
      <small>{suffix}</small>
    </span>
  );
}

export function ElectronicsWhyChooseUs() {
  return (
    <section className="electronics-trust" aria-label="Why choose us">
      {([
        ["Official Warranty", "Clear warranty support for compatible products."],
        ["Fast Delivery", "Delivery rates and zones configured by the seller."],
        ["Secure Payment", "Checkout methods are managed per store."],
        ["Easy Returns", "Prepare return policy messaging for customers."]
      ] satisfies Array<[string, string]>).map(([title, text]) => (
        <article key={title}>
          <span>{title.slice(0, 2).toUpperCase()}</span>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </section>
  );
}

export function ElectronicsNewsletter() {
  return (
    <section className="electronics-newsletter" aria-labelledby="electronics-newsletter-title">
      <p>Newsletter</p>
      <h2 id="electronics-newsletter-title">Get product drops and tech offers first.</h2>
      <form>
        <input aria-label="Email address" placeholder="Email address" type="email" />
        <button type="button">Subscribe</button>
      </form>
    </section>
  );
}
