import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPrice } from "../../components/product-card";
import type { StorefrontProduct } from "../../storefront.types";

export function ElectronicsSection({
  children,
  eyebrow,
  id,
  title
}: {
  children: ReactNode;
  eyebrow: string;
  id: string;
  title: string;
}) {
  return (
    <section className="sf-section electronics-section" id={id} aria-labelledby={`${id}-title`}>
      <div className="sf-section-heading">
        <div>
          <p>{eyebrow}</p>
          <h2 id={`${id}-title`}>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export function ElectronicsProductGrid({
  currency,
  emptyText,
  emptyTitle,
  products,
  storeSlug
}: {
  currency: string;
  emptyText: string;
  emptyTitle: string;
  products: StorefrontProduct[];
  storeSlug: string;
}) {
  if (products.length === 0) {
    return (
      <div className="sf-empty">
        <h3>{emptyTitle}</h3>
        <p>{emptyText}</p>
      </div>
    );
  }

  return (
    <div className="electronics-product-grid">
      {products.map((product) => (
        <ElectronicsProductCard currency={currency} key={product.id} product={product} storeSlug={storeSlug} />
      ))}
    </div>
  );
}

export function ElectronicsProductCard({
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
    <article className="electronics-product-card">
      <Link className="electronics-product-card-media" href={`/s/${storeSlug}/products/${product.slug}`}>
        {image ? <img alt={image.alt ?? product.title} src={image.url} /> : <span>No image</span>}
        {isSale ? <strong>Deal</strong> : null}
      </Link>
      <div className="electronics-product-card-body">
        <div>
          <p>{product.category?.name ?? "Electronics"}</p>
          <h3>
            <Link href={`/s/${storeSlug}/products/${product.slug}`}>{product.title}</Link>
          </h3>
        </div>
        <ProductPrice
          compareAtPrice={product.compareAtPrice?.toString()}
          currency={currency}
          price={product.price.toString()}
        />
        <dl className="electronics-spec-list">
          <div>
            <dt>Brand</dt>
            <dd>Store verified</dd>
          </div>
          <div>
            <dt>Warranty</dt>
            <dd>Seller support</dd>
          </div>
          <div>
            <dt>Stock</dt>
            <dd>{product.stockQuantity > 0 ? "Available" : "Out"}</dd>
          </div>
        </dl>
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

export function ElectronicsDealsBanner({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="sf-section electronics-deals" aria-labelledby="electronics-deals-title">
      <div>
        <p>Deals / Offers</p>
        <h2 id="electronics-deals-title">Upgrade your setup with sharp offers.</h2>
        <span>Use this section for flash deals, bundles, accessories, and seasonal device offers.</span>
      </div>
      <Link className="sf-button" href={`/s/${storeSlug}/products`}>
        Browse deals
      </Link>
    </section>
  );
}

export function ElectronicsBrandStrip() {
  return (
    <section className="sf-section electronics-brand-strip" aria-labelledby="electronics-brands-title">
      <div>
        <p>Top Brands</p>
        <h2 id="electronics-brands-title">Brand showcases ready for expansion</h2>
      </div>
      <div>
        {["Smartphones", "Laptops", "Audio", "Accessories"].map((brand) => (
          <span key={brand}>{brand}</span>
        ))}
      </div>
    </section>
  );
}

export function ElectronicsWarrantyBadges() {
  return (
    <section className="sf-trust electronics-trust" aria-label="Electronics support badges">
      {[
        ["Warranty Support", "Seller-managed product warranty information."],
        ["Secure Checkout", "Protected ordering with store-scoped checkout."],
        ["Fast Delivery", "Shipping rates and delivery options are configured by the seller."],
        ["Tech Support", "Contact information appears from store settings."]
      ].map(([title, text]) => (
        <article key={title}>
          <h3>{title}</h3>
          <p>{text}</p>
        </article>
      ))}
    </section>
  );
}
