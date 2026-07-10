import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ProductPrice } from "../../components/product-card";
import { StorefrontImage } from "../../components/storefront-image";
import type { StorefrontProduct } from "../../storefront.types";
import type {
  StorefrontAdvancedSettings,
  StorefrontElectronicsHomepageSettings
} from "../../customization";
import { ElectronicsCategoryCarousel, type ElectronicsCarouselItem } from "./electronics-category-carousel";
import {
  ElectronicsRecommendedForYouClient,
  type ElectronicsRecommendedCategory,
  type ElectronicsRecommendedProduct
} from "./electronics-recommended-for-you";
import styles from "./electronics-hero.module.css";

type ElectronicsSectionProps = {
  actionHref?: string;
  actionLabel?: string | undefined;
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
  electronicsSettings,
  heroSettings,
  products,
  storeSlug,
  subtitle,
  title
}: {
  categories: ElectronicsCategory[];
  electronicsSettings?: StorefrontElectronicsHomepageSettings | undefined;
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
  const [gamingCard, headphonesCard, watchCard] = electronicsSettings?.heroPromoCards ?? [];
  const homeHref = `/s/${storeSlug}`;

  return (
    <section className={styles.section} aria-labelledby="electronics-hero-title">
      <div className={styles.grid}>
        <article className={`${styles.card} ${styles.mainCard}`}>
          <div className={styles.mainCopy}>
            <span className={styles.status}>In stock now</span>
            <h1 id="electronics-hero-title">{title || "High-Output Mobile Devices"}</h1>
            <p>{subtitle || heroSettings?.subtitle || "Find your perfect phone - sleek and stylish or budget-friendly."}</p>
            <Link className={styles.cta} href={resolveStorefrontHref(homeHref, heroSettings?.button1Link || "/products")}>
              {heroSettings?.button1Text || "Shop Now"}
            </Link>
          </div>
          <div className={styles.mainMedia}>
            <StorefrontImage alt="" fallback="Mobile" loading="eager" src={heroImage} />
          </div>
        </article>

        <PromoCard
          badge={gamingCard?.badge || "Gaming"}
          className={`${styles.middleCard} ${styles.promoCardTall}`}
          fallback="Gaming"
          href={resolveStorefrontHref(homeHref, gamingCard?.ctaLink || "/categories/gaming")}
          imageUrl={gamingCard?.imageUrl || gamingImage}
          title={gamingCard?.title || "Find ideal gaming consoles"}
        />

        <div className={styles.rightColumn}>
          <PromoCard
            badge={headphonesCard?.badge || "Headphones"}
            className={styles.headphoneCard}
            fallback="Audio"
            href={resolveStorefrontHref(homeHref, headphonesCard?.ctaLink || "/categories/audio")}
            imageUrl={headphonesCard?.imageUrl || headphonesImage}
            title={headphonesCard?.title || "High-quality sound"}
          />
          <PromoCard
            badge={watchCard?.badge || "Smart Watches"}
            className={styles.watchCard}
            fallback="Watch"
            href={resolveStorefrontHref(homeHref, watchCard?.ctaLink || "/products?search=watch")}
            imageUrl={watchCard?.imageUrl || watchImage}
            title={watchCard?.title || "Smart features, long battery life"}
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
  href,
  imageUrl,
  title
}: {
  badge: string;
  className: string | undefined;
  fallback: string;
  href: string;
  imageUrl: string | null | undefined;
  title: string;
}) {
  return (
    <Link className={`${styles.card} ${styles.promoCard} ${className ?? ""}`} href={href}>
      <div className={styles.promoMedia}>
        <StorefrontImage alt="" fallback={fallback} src={imageUrl} />
      </div>
      <div className={styles.promoText}>
        <span className={styles.badge}>{badge}</span>
        <h2>{title}</h2>
      </div>
    </Link>
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
  count = 5,
  currency,
  products,
  storeSlug,
  variant = "standard"
}: {
  count?: number | undefined;
  currency: string;
  products: StorefrontProduct[];
  storeSlug: string;
  variant?: "deal" | "standard";
}) {
  const items = products.length > 0 ? products.slice(0, count) : fallbackProducts.slice(0, count);

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
  count,
  currency,
  electronicsSettings,
  products,
  storeSlug
}: {
  count?: number | undefined;
  currency: string;
  electronicsSettings?: StorefrontElectronicsHomepageSettings | undefined;
  products: StorefrontProduct[];
  storeSlug: string;
}) {
  return (
    <section className="electronics-flash-deals" aria-labelledby="electronics-flash-title">
      <div className="electronics-flash-header">
        <div>
          <p>{electronicsSettings?.flashDealEyebrow ?? "Flash Deals"}</p>
          <h2 id="electronics-flash-title">{electronicsSettings?.flashDealTitle ?? "Limited-time tech offers"}</h2>
        </div>
        <div aria-label="Countdown placeholder">
          <span>02</span>
          <span>18</span>
          <span>44</span>
        </div>
      </div>
      <ElectronicsProductGrid count={count} currency={currency} products={products} storeSlug={storeSlug} variant="deal" />
    </section>
  );
}

export function ElectronicsTechnologyBanner({
  electronicsSettings,
  products = [],
  storeSlug
}: {
  electronicsSettings?: StorefrontElectronicsHomepageSettings | undefined;
  products?: StorefrontProduct[];
  storeSlug: string;
}) {
  const defaultPromoCards = [
    {
      backgroundColor: "#373e66",
      badge: "45% OFF",
      className: "electronics-promo-card-cooker",
      ctaLink: "/products?search=electric%20cooker",
      ctaText: "Shop now",
      description: "Let technology do the cooking - now 45% off!",
      fallback: "EC",
      imageUrl: products[0]?.images[0]?.url,
      title: "Electric Cooker"
    },
    {
      backgroundColor: "#a9c2e2",
      badge: "35% OFF",
      className: "electronics-promo-card-coffee",
      ctaLink: "/products?search=coffee",
      ctaText: "Shop now",
      description: "Experience bold flavor - 35% off today!",
      fallback: "CM",
      imageUrl: products[1]?.images[0]?.url,
      title: "Coffee Machines"
    },
    {
      backgroundColor: "#e7edff",
      badge: "",
      className: "electronics-promo-card-display",
      ctaLink: "/products?search=display",
      ctaText: "Shop now",
      description: "",
      fallback: "TV",
      imageUrl: products[2]?.images[0]?.url,
      title: "TV & Display"
    },
    {
      backgroundColor: "#d6edf5",
      badge: "",
      className: "electronics-promo-card-fryer",
      ctaLink: "/products?search=air%20fryer",
      ctaText: "Shop now",
      description: "",
      fallback: "AF",
      imageUrl: products[3]?.images[0]?.url,
      title: "Air Fryers"
    },
    {
      backgroundColor: "#131b5b",
      badge: "",
      className: "electronics-promo-card-humidifier",
      ctaLink: "/products?search=humidifier",
      ctaText: "Shop now",
      description: "Breathe easier and sleep better with cleaner, fresher air.",
      fallback: "HU",
      imageUrl: products[4]?.images[0]?.url,
      title: "Humidifier"
    }
  ];
  const configuredCards = electronicsSettings?.promoCards ?? [];
  const promoCards = defaultPromoCards.map((fallback, index) => {
    const configured = configuredCards[index];

    return {
      ...fallback,
      ...configured,
      className: fallback.className,
      fallback: fallback.fallback,
      imageUrl: configured?.imageUrl || products[index]?.images[0]?.url || fallback.imageUrl
    };
  });
  const homeHref = `/s/${storeSlug}`;

  return (
    <section className="electronics-promo-deals" aria-labelledby="electronics-promo-title">
      <h2 id="electronics-promo-title">{electronicsSettings?.promoSectionTitle ?? "Urgent Sale - Home Essentials You'll Love!"}</h2>
      <div className="electronics-promo-grid">
        {promoCards.map((card) => (
          <article
            className={`electronics-promo-card ${card.className}`}
            key={card.title}
            style={{ "--electronics-promo-bg": card.backgroundColor } as CSSProperties}
          >
            {card.badge ? <PromoBadge label={card.badge} /> : null}
            <div className="electronics-promo-image">
              <StorefrontImage alt="" fallback={card.fallback} src={card.imageUrl} />
            </div>
            <div className="electronics-promo-copy">
              <h3>{card.title}</h3>
              {card.description ? <p>{card.description}</p> : null}
              <Link href={resolveStorefrontHref(homeHref, card.ctaLink)}>{card.ctaText || "Shop now"}</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function ElectronicsRecommendedForYou({
  categories = [],
  currency,
  electronicsSettings,
  products = [],
  storeSlug
}: {
  categories?: ElectronicsCategory[];
  currency: string;
  electronicsSettings?: StorefrontElectronicsHomepageSettings | undefined;
  products?: StorefrontProduct[];
  storeSlug: string;
}) {
  const uniqueProducts = Array.from(new Map(products.map((product) => [product.id, product])).values());
  const clientCategories: ElectronicsRecommendedCategory[] = categories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug
  }));
  const clientProducts: ElectronicsRecommendedProduct[] = uniqueProducts.map((product) => ({
    category: product.category
      ? {
          id: product.category.id,
          name: product.category.name,
          slug: product.category.slug
        }
      : null,
    compareAtPrice: product.compareAtPrice?.toString() ?? null,
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
    <ElectronicsRecommendedForYouClient
      categories={clientCategories}
      currency={currency}
      products={clientProducts}
      storeSlug={storeSlug}
      title={electronicsSettings?.recommendedTitle}
    />
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

export function ElectronicsWhyChooseUs({
  items
}: {
  items?: StorefrontElectronicsHomepageSettings["trustItems"] | undefined;
}) {
  const trustItems = items?.length ? items : [
    { title: "Official Warranty", description: "Clear warranty support for compatible products." },
    { title: "Fast Delivery", description: "Delivery rates and zones configured by the seller." },
    { title: "Secure Payment", description: "Checkout methods are managed per store." },
    { title: "Easy Returns", description: "Prepare return policy messaging for customers." }
  ];

  return (
    <section className="electronics-trust" aria-label="Why choose us">
      {trustItems.map((item) => (
        <article key={item.title}>
          <span>{item.title.slice(0, 2).toUpperCase()}</span>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
        </article>
      ))}
    </section>
  );
}

function resolveStorefrontHref(homeHref: string, url: string) {
  if (url.startsWith("http") || url.startsWith("mailto:") || url.startsWith("tel:") || url.startsWith("#")) {
    return url;
  }

  if (url === homeHref || url.startsWith(`${homeHref}/`)) {
    return url;
  }

  return `${homeHref}${url === "/" ? "" : url.startsWith("/") ? url : `/${url}`}`;
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
