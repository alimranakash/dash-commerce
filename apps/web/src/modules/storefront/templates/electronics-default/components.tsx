import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPrice } from "../../components/product-card";
import type { StorefrontProduct } from "../../storefront.types";

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
  name: string;
  slug: string;
};

const fallbackCategories = [
  { icon: "PH", name: "Phones", slug: "phones" },
  { icon: "LP", name: "Laptops", slug: "laptops" },
  { icon: "AC", name: "Accessories", slug: "accessories" },
  { icon: "SH", name: "Smart Home", slug: "smart-home" },
  { icon: "GM", name: "Gaming", slug: "gaming" },
  { icon: "AU", name: "Audio", slug: "audio" }
];

const brandCards = ["Apple", "Samsung", "Sony", "DJI", "Logitech", "Nothing"];

const fallbackProducts = [
  { brand: "Aero", label: "XR", price: 899, title: "AeroPhone XR" },
  { brand: "Nova", label: "NB", price: 1299, title: "NovaBook Pro" },
  { brand: "Pulse", label: "HD", price: 199, title: "Pulse Headphones" },
  { brand: "Orbit", label: "DR", price: 749, title: "Orbit Mini Drone" }
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
      <div className="electronics-section-heading">
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

export function ElectronicsHero({
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
    <section className="electronics-hero" aria-labelledby="electronics-hero-title">
      <div className="electronics-hero-copy">
        <div className="electronics-hero-badges">
          <span>New</span>
          <span>Best Seller</span>
          <span>Special Offer</span>
        </div>
        <p>{storeName}</p>
        <h1 id="electronics-hero-title">{title || "Next generation technology for every setup"}</h1>
        <span>{subtitle || "Discover high-performance devices, accessories, and smart essentials in one clean storefront."}</span>
        <div>
          <Link className="electronics-primary-link" href={`/s/${storeSlug}/products`}>
            Shop Devices
          </Link>
          <Link className="electronics-secondary-link" href={`/s/${storeSlug}/search`}>
            Compare Products
          </Link>
        </div>
      </div>
      <div className="electronics-hero-device" aria-hidden="true">
        <div className="electronics-device-screen" />
        <div className="electronics-device-pad" />
        <div className="electronics-device-earbud" />
      </div>
    </section>
  );
}

export function ElectronicsCategoryGrid({
  categories,
  storeSlug
}: {
  categories: ElectronicsCategory[];
  storeSlug: string;
}) {
  const visibleCategories = categories.length > 0
    ? categories.slice(0, 6).map((category) => ({ icon: category.name.slice(0, 2).toUpperCase(), name: category.name, slug: category.slug }))
    : fallbackCategories;

  return (
    <div className="electronics-category-grid">
      {visibleCategories.map((category) => (
        <Link className="electronics-category-card" href={`/s/${storeSlug}/categories/${category.slug}`} key={category.slug}>
          <span>{category.icon}</span>
          <strong>{category.name}</strong>
        </Link>
      ))}
    </div>
  );
}

export function ElectronicsBrandGrid() {
  return (
    <div className="electronics-brand-grid">
      {brandCards.map((brand) => (
        <div className="electronics-brand-card" key={brand}>
          <span>{brand.slice(0, 2).toUpperCase()}</span>
          <strong>{brand}</strong>
        </div>
      ))}
    </div>
  );
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
  const items = products.length > 0 ? products.slice(0, 4) : fallbackProducts;

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
        {image ? <img alt={image.alt ?? product.title} src={image.url} /> : <span>{product.category?.name?.slice(0, 2).toUpperCase() ?? "TX"}</span>}
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

export function ElectronicsTechnologyBanner({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="electronics-tech-banner" aria-labelledby="electronics-tech-title">
      <div>
        <p>Next Generation Technology</p>
        <h2 id="electronics-tech-title">Build a faster, smarter, connected lifestyle.</h2>
        <span>Feature launches, bundles, smart home setups, or premium accessories in this focused campaign block.</span>
        <Link href={`/s/${storeSlug}/products`}>Explore technology</Link>
      </div>
      <div className="electronics-tech-visual" aria-hidden="true" />
    </section>
  );
}

export function ElectronicsWhyChooseUs() {
  return (
    <section className="electronics-trust" aria-label="Why choose us">
      {[
        ["Official Warranty", "Clear warranty support for compatible products."],
        ["Fast Delivery", "Delivery rates and zones configured by the seller."],
        ["Secure Payment", "Checkout methods are managed per store."],
        ["Easy Returns", "Prepare return policy messaging for customers."]
      ].map(([title, text]) => (
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
