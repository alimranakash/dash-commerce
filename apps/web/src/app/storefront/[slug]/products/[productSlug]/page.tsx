import { notFound } from "next/navigation";
import { ProductPrice, StockStatus } from "../../../../../modules/storefront/components/product-card";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import {
  getStorefrontProductBySlug,
  requireStorefrontBySlug
} from "../../../../../modules/storefront/resolver";

type StorefrontProductPageProps = {
  params: Promise<{
    productSlug: string;
    slug: string;
  }>;
};

export default async function StorefrontProductPage({ params }: StorefrontProductPageProps) {
  const { productSlug, slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const product = await getStorefrontProductBySlug(store.id, productSlug);

  if (!product) {
    notFound();
  }

  const images = product.images;
  const leadImage = images[0];

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <article className="sf-product-detail">
        <section className="sf-gallery" aria-label={`${product.title} images`}>
          <div className="sf-gallery-main">
            {leadImage ? (
              <img alt={leadImage.alt ?? product.title} src={leadImage.url} />
            ) : (
              <span>No image</span>
            )}
          </div>
          {images.length > 1 ? (
            <div className="sf-gallery-thumbs">
              {images.slice(1, 5).map((image) => (
                <div key={image.id}>
                  <img alt={image.alt ?? product.title} src={image.url} />
                </div>
              ))}
            </div>
          ) : null}
        </section>
        <section className="sf-product-info" aria-labelledby="product-title">
          {product.category ? <p>{product.category.name}</p> : null}
          <h1 id="product-title">{product.title}</h1>
          {product.shortDescription ? <span>{product.shortDescription}</span> : null}
          <ProductPrice
            compareAtPrice={product.compareAtPrice?.toString()}
            currency={store.currency}
            price={product.price.toString()}
          />
          <StockStatus stockQuantity={product.stockQuantity} />
          <div className="sf-purchase-box">
            <label htmlFor="quantity">Quantity</label>
            <input defaultValue="1" id="quantity" min="1" name="quantity" type="number" />
            <button disabled type="button">
              Add to Cart
            </button>
          </div>
          <dl className="sf-product-facts">
            {product.sku ? (
              <>
                <dt>SKU</dt>
                <dd>{product.sku}</dd>
              </>
            ) : null}
            <dt>Status</dt>
            <dd>{product.stockQuantity > 0 ? "Available" : "Out of stock"}</dd>
          </dl>
          {product.description ? (
            <div className="sf-description">
              <h2>Details</h2>
              <p>{product.description}</p>
            </div>
          ) : null}
        </section>
      </article>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
