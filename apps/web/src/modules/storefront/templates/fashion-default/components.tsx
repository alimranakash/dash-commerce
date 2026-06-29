import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPrice } from "../../components/product-card";
import type { StorefrontProduct } from "../../storefront.types";

export function FashionSection({
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
    <section className="sf-section fashion-section" id={id} aria-labelledby={`${id}-title`}>
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

export function FashionProductGrid({
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
    <div className="fashion-product-grid">
      {products.map((product) => (
        <FashionProductCard currency={currency} key={product.id} product={product} storeSlug={storeSlug} />
      ))}
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
        {image ? <img alt={image.alt ?? product.title} src={image.url} /> : <span>No image</span>}
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
        <div className="fashion-product-options" aria-label="Fashion options placeholder">
          <span>Color</span>
          <span>Size</span>
          <span>Quick View</span>
        </div>
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

export function FashionPromoBanner({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="sf-section fashion-promo" aria-labelledby="fashion-promo-title">
      <p>Seasonal edit</p>
      <h2 id="fashion-promo-title">Build a wardrobe that moves with your day.</h2>
      <Link className="sf-button" href={`/s/${storeSlug}/products`}>
        Shop the edit
      </Link>
    </section>
  );
}

export function FashionLookbook({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="sf-section fashion-lookbook" aria-labelledby="fashion-lookbook-title">
      <div>
        <p>Lookbook</p>
        <h2 id="fashion-lookbook-title">Style stories for the next drop</h2>
        <span>Prepare editorial outfits, campaign imagery, and curated style guides here.</span>
      </div>
      <Link href={`/s/${storeSlug}/products`}>Explore products</Link>
    </section>
  );
}
