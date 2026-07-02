import Link from "next/link";
import {
  ProductPrice,
  StockStatus
} from "../../../../../modules/storefront/components/product-card";
import { ProductPurchasePanel } from "../../../../../modules/storefront/components/product-purchase-panel";
import { ProductTabs } from "../../../../../modules/storefront/components/product-tabs";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import {
  getRelatedStorefrontProducts,
  getStorefrontProductBySlug,
  requireStorefrontBySlug
} from "../../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../../modules/storefront/templates/registry";

type StorefrontProductPageProps = {
  params: Promise<{
    productSlug: string;
    slug: string;
  }>;
  searchParams: Promise<{
    cartError?: string;
  }>;
};

export default async function StorefrontProductPage({
  params,
  searchParams
}: StorefrontProductPageProps) {
  const { productSlug, slug } = await params;
  const { cartError } = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const template = getStorefrontTemplateForStore(store);
  const TemplateProductCard = template.components.ProductCard;
  const ProductDetailExtras = template.components.ProductDetailExtras;
  const product = await getStorefrontProductBySlug(store.id, productSlug);

  if (!product) {
    return (
      <main className="sf-page" data-storefront-template={template.id}>
        <StorefrontHeader store={store} />
        <section className="sf-missing" aria-labelledby="product-404">
          <p>Product unavailable</p>
          <h1 id="product-404">This product is not available.</h1>
          <span>It may have been unpublished, archived, or moved by the seller.</span>
          <Link className="sf-button" href={`/s/${store.slug}/products`}>
            Back to products
          </Link>
        </section>
        <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
      </main>
    );
  }

  const images = product.images;
  const leadImage = images[0];
  const brandName = store.name;
  const badges = getProductBadges({
    compareAtPrice: product.compareAtPrice?.toString(),
    createdAt: product.createdAt,
    price: product.price.toString(),
    stockQuantity: product.stockQuantity
  });
  const relatedProducts = await getRelatedStorefrontProducts({
    categoryId: product.categoryId,
    productId: product.id,
    storeId: store.id
  });

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <nav className="sf-breadcrumb" aria-label="Breadcrumb">
        <Link href={`/s/${store.slug}`}>Home</Link>
        <span>&gt;</span>
        {product.category ? (
          <Link href={`/s/${store.slug}/categories/${product.category.slug}`}>{product.category.name}</Link>
        ) : (
          <Link href={`/s/${store.slug}/products`}>Products</Link>
        )}
        <span>&gt;</span>
        <strong>{product.title}</strong>
      </nav>

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
              {images.slice(0, 6).map((image) => (
                <div key={image.id}>
                  <img alt={image.alt ?? product.title} src={image.url} />
                </div>
              ))}
            </div>
          ) : null}
        </section>
        <section className="sf-product-info" aria-labelledby="product-title">
          <div className="sf-product-badges">
            {badges.map((badge) => (
              <span className={badge.toLowerCase().replace(/\s/g, "-")} key={badge}>
                {badge}
              </span>
            ))}
          </div>
          <p>{product.category?.name ?? "Product"}</p>
          <h1 id="product-title">{product.title}</h1>
          <dl className="sf-product-meta-list">
            {product.sku ? (
              <>
                <dt>SKU</dt>
                <dd>{product.sku}</dd>
              </>
            ) : null}
            <dt>Brand</dt>
            <dd>{brandName}</dd>
            {product.category ? (
              <>
                <dt>Category</dt>
                <dd>{product.category.name}</dd>
              </>
            ) : null}
          </dl>
          {product.shortDescription ? <span>{product.shortDescription}</span> : null}
          <ProductPrice
            compareAtPrice={product.compareAtPrice?.toString()}
            currency={store.currency}
            price={product.price.toString()}
          />
          <StockStatus stockQuantity={product.stockQuantity} />
          {ProductDetailExtras ? <ProductDetailExtras product={product} store={store} /> : null}
          {cartError ? <p className="sf-alert">{cartError}</p> : null}
          <ProductPurchasePanel
            maxQuantity={product.stockQuantity}
            productId={product.id}
            productSlug={product.slug}
            storeId={store.id}
            storeSlug={store.slug}
          />
        </section>
      </article>

      <ProductTabs
        brand={brandName}
        categoryName={product.category?.name ?? null}
        description={product.description}
        sku={product.sku}
      />

      {relatedProducts.length > 0 ? (
        <section className="sf-section sf-related-products" aria-labelledby="related-products">
          <div className="sf-section-heading">
            <p>Related</p>
            <h2 id="related-products">You may also like</h2>
          </div>
          <div className="sf-product-grid">
            {relatedProducts.map((relatedProduct) => (
              <TemplateProductCard
                currency={store.currency}
                key={relatedProduct.id}
                product={relatedProduct}
                storeSlug={store.slug}
              />
            ))}
          </div>
        </section>
      ) : null}

      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

function getProductBadges(input: {
  compareAtPrice: string | undefined;
  createdAt: Date;
  price: string;
  stockQuantity: number;
}) {
  const badges: string[] = [];
  const createdAtTime = input.createdAt.getTime();
  const thirtyDaysAgo = Date.now() - 1000 * 60 * 60 * 24 * 30;

  if (createdAtTime >= thirtyDaysAgo) {
    badges.push("New");
  }

  if (input.compareAtPrice && Number(input.compareAtPrice) > Number(input.price)) {
    badges.push("Sale");
  }

  if (input.stockQuantity < 1) {
    badges.push("Out of Stock");
  }

  return badges;
}
