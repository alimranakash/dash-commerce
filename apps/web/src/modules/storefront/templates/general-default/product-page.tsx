import type { ComponentType } from "react";
import Link from "next/link";
import {
  ProductGrid,
  ProductPrice,
  SectionHeader
} from "../../components/product-listing";
import { ProductPurchasePanel } from "../../components/product-purchase-panel";
import type {
  StorefrontProductPageSettings,
  StorefrontProductSectionSettings
} from "../../customization";
import type {
  StorefrontTemplateProductDetailExtrasProps
} from "../types";
import type {
  StorefrontProduct,
  StorefrontProductDetails,
  StorefrontStore
} from "../../storefront.types";
import { GeneralProductAccordion } from "./product-accordion";
import { GeneralProductGallery } from "./product-gallery";

type GeneralProductPageProps = {
  cartError?: string;
  primaryDomain?: string | undefined;
  product: StorefrontProductDetails;
  ProductDetailExtras?: ComponentType<StorefrontTemplateProductDetailExtrasProps> | undefined;
  productPage: StorefrontProductPageSettings;
  relatedProducts: StorefrontProduct[];
  relatedSection: StorefrontProductSectionSettings;
  store: StorefrontStore;
};

export function GeneralProductPage({
  cartError,
  product,
  ProductDetailExtras,
  productPage,
  relatedProducts,
  relatedSection,
  store
}: GeneralProductPageProps) {
  const badge = productBadge(product);
  const description = product.description || product.shortDescription || `${product.title} is ready for your everyday shopping routine.`;
  const descriptionParagraphs = description.split(/\r?\n+/).filter(Boolean).slice(0, 4);
  const relatedGridId = "storefront-related-product-grid";

  return (
    <>
      {productPage.breadcrumbEnabled ? <GeneralProductBreadcrumb product={product} store={store} /> : null}

      <article className="general-product-detail" aria-labelledby="product-title">
        <GeneralProductGallery product={product} settings={productPage} />

        <aside className="general-product-info">
          {badge ? <span className="general-product-sale-badge">{badge}</span> : null}
          <h1 id="product-title">{product.title}</h1>
          <ProductPrice
            compareAtPrice={product.compareAtPrice?.toString()}
            currency={store.currency}
            price={product.price.toString()}
          />

          {product.shortDescription ? <p className="general-product-short-copy">{product.shortDescription}</p> : null}

          {productPage.variantEnabled ? (
            <GeneralProductVariantSelector
              product={product}
              style={productPage.variantStyle}
            />
          ) : null}

          <p className="general-product-stock">
            {product.stockQuantity > 0 ? `${product.stockQuantity} in Stock` : "Out of Stock"}
          </p>

          {cartError ? <p className="sf-alert">{cartError}</p> : null}

          <ProductPurchasePanel
            addToCartButtonColor={productPage.addToCartButtonColor}
            addToCartButtonRadius={productPage.addToCartButtonRadius}
            addToCartText={productPage.addToCartText}
            buyNowEnabled={productPage.buyNowEnabled}
            maxQuantity={product.stockQuantity}
            productId={product.id}
            productSlug={product.slug}
            secondaryActionsEnabled={false}
            storeId={store.id}
            storeSlug={store.slug}
          />

          {productPage.shippingEnabled ? (
            <div className="general-product-shipping" aria-label="Shipping information">
              <span>{productPage.shippingNotice}</span>
              <span>Secure checkout</span>
              <span>Easy returns</span>
            </div>
          ) : null}

          {ProductDetailExtras ? <ProductDetailExtras product={product} store={store} /> : null}

          <p className="general-product-tagline">
            {product.shortDescription || "Carefully selected for daily use, simple routines, and dependable shopping."}
          </p>

          {productPage.accordionEnabled ? (
            <GeneralProductAccordion items={accordionItems(product, store.name)} />
          ) : null}
        </aside>
      </article>

      <section className="general-product-description-block" aria-labelledby="product-description-title">
        <h2 id="product-description-title">Designed for everyday use.</h2>
        {descriptionParagraphs.map((paragraph, index) => (
          <p key={`${paragraph}-${index}`}>{paragraph}</p>
        ))}
      </section>

      {relatedProducts.length > 0 ? (
        <section className="general-product-related general-product-section" aria-labelledby="related-products">
          <SectionHeader
            ctaHref={`/s/${store.slug}/products`}
            ctaText={relatedSection.ctaText}
            id="related-products"
            sliderTargetId={relatedGridId}
            subtitle={relatedSection.subtitle}
            title={relatedSection.title || "You May Also Like"}
          />
          <ProductGrid
            currency={store.currency}
            gridId={relatedGridId}
            products={relatedProducts}
            section={{ ...relatedSection, count: 4, mode: "slider" }}
            storeSlug={store.slug}
          />
        </section>
      ) : null}

      {productPage.promoBlocksEnabled ? (
        <GeneralProductPromoBlocks product={product} relatedProducts={relatedProducts} store={store} />
      ) : null}
    </>
  );
}

function GeneralProductBreadcrumb({
  product,
  store
}: {
  product: StorefrontProductDetails;
  store: StorefrontStore;
}) {
  return (
    <nav className="general-product-breadcrumb" aria-label="Breadcrumb">
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
  );
}

function GeneralProductVariantSelector({
  product,
  style
}: {
  product: StorefrontProductDetails;
  style: StorefrontProductPageSettings["variantStyle"];
}) {
  const options = product.sku ? [product.sku, "Standard"] : ["Standard", "Premium"];

  if (style === "dropdown") {
    return (
      <label className="general-product-variant-select">
        Option
        <select defaultValue={options[0]}>
          {options.map((option) => <option key={option}>{option}</option>)}
        </select>
      </label>
    );
  }

  return (
    <div className="general-product-variants" aria-label="Product options">
      <span>Option</span>
      <div>
        {options.map((option, index) => (
          <button aria-pressed={index === 0} key={option} type="button">
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function GeneralProductPromoBlocks({
  product,
  relatedProducts,
  store
}: {
  product: StorefrontProductDetails;
  relatedProducts: StorefrontProduct[];
  store: StorefrontStore;
}) {
  const visuals = [
    product.images[1]?.url ?? product.images[0]?.url,
    relatedProducts[0]?.images[0]?.url ?? product.images[0]?.url,
    relatedProducts[1]?.images[0]?.url ?? product.images[0]?.url
  ];

  return (
    <section className="general-product-promo-grid" aria-label="Product stories">
      <PromoBlock
        imageUrl={visuals[0]}
        title="Built for Daily Rituals"
        subtitle={`Explore more from ${product.category?.name ?? store.name}`}
      />
      <div>
        <PromoBlock
          imageUrl={visuals[1]}
          title="Selected With Care"
          subtitle="Simple details, dependable quality."
        />
        <PromoBlock
          imageUrl={visuals[2]}
          title="Discover the Collection"
          subtitle="Shop more pieces made for your routine."
          href={`/s/${store.slug}/products`}
        />
      </div>
    </section>
  );
}

function PromoBlock({
  href,
  imageUrl,
  subtitle,
  title
}: {
  href?: string;
  imageUrl?: string | null | undefined;
  subtitle: string;
  title: string;
}) {
  const content = (
    <>
      {imageUrl ? <img alt="" loading="lazy" src={imageUrl} /> : null}
      <span>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </span>
    </>
  );

  return href ? (
    <Link className="general-product-promo-block" href={href}>
      {content}
    </Link>
  ) : (
    <div className="general-product-promo-block">
      {content}
    </div>
  );
}

function accordionItems(product: StorefrontProductDetails, storeName: string) {
  return [
    {
      content: product.description || product.shortDescription || "Product details will be updated soon.",
      title: "Description"
    },
    {
      content: "Keep the product clean, dry, and stored safely when not in use.",
      title: "Product Care"
    },
    {
      content: `${storeName} supports reliable delivery and clear return communication for every order.`,
      title: "Shipping & Returns"
    },
    {
      content: product.sku ? `SKU: ${product.sku}` : "Additional product information will appear here when available.",
      title: "Additional Information"
    }
  ];
}

function productBadge(product: StorefrontProductDetails) {
  if (product.stockQuantity <= 0) {
    return "OUT OF STOCK";
  }

  if (product.compareAtPrice && Number(product.compareAtPrice) > Number(product.price)) {
    return "SALE";
  }

  return "";
}
