import Link from "next/link";
import type { ReactNode } from "react";
import { ProductPrice } from "../../components/product-card";
import type { StorefrontProduct } from "../../storefront.types";

export function BeautySection({
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
    <section className="sf-section beauty-section" id={id} aria-labelledby={`${id}-title`}>
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

export function BeautyProductGrid({
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
    <div className="beauty-product-grid">
      {products.map((product) => (
        <BeautyProductCard currency={currency} key={product.id} product={product} storeSlug={storeSlug} />
      ))}
    </div>
  );
}

export function BeautyProductCard({
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
    <article className="beauty-product-card">
      <Link className="beauty-product-card-media" href={`/s/${storeSlug}/products/${product.slug}`}>
        {image ? <img alt={image.alt ?? product.title} src={image.url} /> : <span>No image</span>}
        {isSale ? <strong>Sale</strong> : null}
      </Link>
      <div className="beauty-product-card-body">
        <div>
          <p>{product.category?.name ?? "Beauty"}</p>
          <h3>
            <Link href={`/s/${storeSlug}/products/${product.slug}`}>{product.title}</Link>
          </h3>
        </div>
        <ProductPrice
          compareAtPrice={product.compareAtPrice?.toString()}
          currency={currency}
          price={product.price.toString()}
        />
        <div className="beauty-product-tags" aria-label="Beauty options placeholder">
          <span>Skin type</span>
          <span>Shade</span>
          <span>Variant</span>
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

export function BeautyRoutineBlocks({ storeSlug }: { storeSlug: string }) {
  return (
    <section className="sf-section beauty-routine-grid" aria-labelledby="beauty-routines-title">
      <div className="beauty-routine-card">
        <p>Skincare</p>
        <h2 id="beauty-routines-title">Daily skincare essentials</h2>
        <span>Prepare curated routines for cleansers, serums, moisturizers, and SPF.</span>
        <Link href={`/s/${storeSlug}/products`}>Shop skincare</Link>
      </div>
      <div className="beauty-routine-card accent">
        <p>Makeup</p>
        <h2>Color, glow, and finish</h2>
        <span>Feature makeup edits, shades, launches, and seasonal beauty drops.</span>
        <Link href={`/s/${storeSlug}/products`}>Shop makeup</Link>
      </div>
    </section>
  );
}

export function BeautyReviewsPlaceholder() {
  return (
    <section className="sf-section beauty-reviews" aria-labelledby="beauty-reviews-title">
      <p>Customer Reviews</p>
      <h2 id="beauty-reviews-title">Real feedback will shine here</h2>
      <span>Review highlights, ratings, before/after notes, and customer stories can be added later.</span>
    </section>
  );
}

export function BeautyTipsPlaceholder() {
  return (
    <section className="sf-section beauty-tips" aria-labelledby="beauty-tips-title">
      <div>
        <p>Beauty Tips</p>
        <h2 id="beauty-tips-title">Guides for routines, shades, and self-care</h2>
      </div>
      <div>
        {["Choose the right shade", "Layer skincare gently", "Patch test new products"].map((tip) => (
          <article key={tip}>
            <h3>{tip}</h3>
            <p>Educational content placeholder for future beauty guides.</p>
          </article>
        ))}
      </div>
    </section>
  );
}
