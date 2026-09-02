import { NotificationBarSlot } from "../../../notification-bar/components/notification-bar-slot";
import { FreeShippingBarSlot } from "../../../free-shipping/components/free-shipping-bar-slot";
import { storefrontBasePath } from "../../base-path";
import { preorderLabel } from "../../format";
import type { ComponentType } from "react";
import Link from "next/link";
import { ProductGrid, ProductPrice, SectionHeader } from "../../components/product-listing";
import { ProductPurchasePanel } from "../../components/product-purchase-panel";
import {
  RecentlyViewedSection,
  type RecentlyViewedProduct
} from "../../components/recently-viewed-section";
import type {
  StorefrontProductPageSettings,
  StorefrontProductSectionSettings
} from "../../customization";
import { storefrontSectionHref } from "../../product-sections";
import type { StorefrontTemplateProductDetailExtrasProps } from "../types";
import type {
  StorefrontProduct,
  StorefrontProductDetails,
  StorefrontStore
} from "../../storefront.types";
import { GeneralProductAccordion } from "./product-accordion";
import { GeneralProductGallery } from "./product-gallery";
import { ProductVariantControls } from "./product-variant-controls";
import { toProductCardProducts } from "../../product-card-data";

type GeneralProductPageProps = {
  // Forwarded to the related and recently viewed grids so those rows use the same
  // card as the rest of the active template.
  cardVariant?: string | undefined;
  cartError?: string | undefined;
  product: StorefrontProductDetails;
  ProductDetailExtras?: ComponentType<StorefrontTemplateProductDetailExtrasProps> | undefined;
  productPage: StorefrontProductPageSettings;
  recentlyViewedSection: StorefrontProductSectionSettings;
  relatedProducts: StorefrontProduct[];
  relatedSection: StorefrontProductSectionSettings;
  store: StorefrontStore;
};

export async function GeneralProductPage({
  cardVariant,
  cartError,
  product,
  ProductDetailExtras,
  productPage,
  recentlyViewedSection,
  relatedProducts,
  relatedSection,
  store
}: GeneralProductPageProps) {
  const basePath = await storefrontBasePath(store.slug);
  const badge = productBadge(product);
  const description =
    product.description ||
    product.shortDescription ||
    `${product.title} is ready for your everyday shopping routine.`;
  const descriptionParagraphs = description
    .split(/\r?\n+/)
    .filter(Boolean)
    .slice(0, 4);
  const galleryImages = product.images.map((image) => ({
    alt: image.alt ?? product.title,
    id: image.id,
    url: image.url
  }));
  const relatedGridId = "storefront-related-product-grid";
  const variantConfiguration = product.variantConfiguration;
  const hasVariants = variantConfiguration.variants.length > 0;

  return (
    // Every band below shares one measure through this wrapper, so the
    // breadcrumb, the detail row and the rails under it line up on one grid.
    <div className="general-product-page">
      {productPage.breadcrumbEnabled ? (
        <GeneralProductBreadcrumb product={product} store={store} />
      ) : null}

      <article className="general-product-detail" aria-labelledby="product-title">
        <GeneralProductGallery
          images={galleryImages}
          settings={productPage}
          title={product.title}
        />

        <aside className="general-product-info">
          {badge ? <span className="general-product-sale-badge">{badge}</span> : null}
          <h1 id="product-title">{product.title}</h1>
          {hasVariants ? null : (
            <ProductPrice
              compareAtPrice={product.compareAtPrice?.toString()}
              currency={store.currency}
              price={product.price.toString()}
            />
          )}

          {product.shortDescription ? (
            <p className="general-product-short-copy">{product.shortDescription}</p>
          ) : null}

          {cartError ? <p className="sf-alert">{cartError}</p> : null}

          {/* Either side of the buy box — the two placements that actually move
            a shopper, and the reason the product page has its own slot setting
            rather than only a top and a bottom. Both render nothing unless the
            seller picked that anchor. */}
          <NotificationBarSlot anchor="above_cart" store={store} surface="product" />

          {hasVariants ? (
            <ProductVariantControls
              addToCartButtonColor={productPage.addToCartButtonColor}
              addToCartButtonRadius={productPage.addToCartButtonRadius}
              addToCartText={productPage.addToCartText}
              baseCompareAtPrice={product.compareAtPrice?.toString()}
              basePrice={product.price.toString()}
              baseSku={product.sku}
              baseStockQuantity={product.stockQuantity}
              buyNowEnabled={productPage.buyNowEnabled}
              currency={store.currency}
              productId={product.id}
              productSlug={product.slug}
              storeId={store.id}
              storeSlug={store.slug}
              variantConfiguration={variantConfiguration}
              variantEnabled={productPage.variantEnabled}
              variantStyle={productPage.variantStyle}
            />
          ) : (
            <>
              <p className="general-product-stock">
                {product.stockQuantity > 0
                  ? `${product.stockQuantity} in Stock`
                  : product.allowPreorder
                    ? preorderLabel(product.preorderReleaseAt)
                    : "Out of Stock"}
              </p>
              <ProductPurchasePanel
                addToCartButtonColor={productPage.addToCartButtonColor}
                addToCartButtonRadius={productPage.addToCartButtonRadius}
                addToCartText={productPage.addToCartText}
                buyNowEnabled={productPage.buyNowEnabled}
                maxQuantity={product.allowPreorder ? 999999 : product.stockQuantity}
                productId={product.id}
                productSlug={product.slug}
                secondaryActionsEnabled={false}
                storeId={store.id}
                storeSlug={store.slug}
              />
            </>
          )}

          <NotificationBarSlot anchor="below_cart" store={store} surface="product" />

          {/* Under the buy button, where the gap it names can still be closed by
            the thing the shopper is looking at. Renders nothing unless the shop
            has a threshold checkout enforces. */}
          <FreeShippingBarSlot productId={product.id} store={store} surface="product" />

          {productPage.shippingEnabled ? (
            <div className="general-product-shipping" aria-label="Shipping information">
              <span>{productPage.shippingNotice}</span>
              <span>Secure checkout</span>
              <span>Easy returns</span>
            </div>
          ) : null}

          {ProductDetailExtras ? <ProductDetailExtras product={product} store={store} /> : null}

          <p className="general-product-tagline">
            {product.shortDescription ||
              "Carefully selected for daily use, simple routines, and dependable shopping."}
          </p>

          {productPage.accordionEnabled ? (
            <GeneralProductAccordion items={accordionItems(product, store.name)} />
          ) : null}
        </aside>
      </article>

      <section
        className="general-product-description-block"
        aria-labelledby="product-description-title"
      >
        <h2 id="product-description-title">About {product.title}</h2>
        {descriptionParagraphs.map((paragraph, index) => (
          <p key={`${paragraph}-${index}`}>{paragraph}</p>
        ))}
      </section>

      {relatedProducts.length > 0 ? (
        <section
          className="general-product-related general-product-section"
          aria-labelledby="related-products"
        >
          <SectionHeader
            ctaHref={storefrontSectionHref(basePath, relatedSection.ctaLink)}
            ctaText={relatedSection.ctaText}
            id="related-products"
            sliderTargetId={relatedSection.mode === "slider" ? relatedGridId : undefined}
            subtitle={relatedSection.subtitle}
            title={relatedSection.title || "You May Also Like"}
          />
          <ProductGrid
            cardVariant={cardVariant}
            currency={store.currency}
            gridId={relatedGridId}
            products={toProductCardProducts(relatedProducts)}
            section={relatedSection}
            storeId={store.id}
            storeSlug={store.slug}
          />
        </section>
      ) : null}

      <RecentlyViewedSection
        cardVariant={cardVariant}
        currency={store.currency}
        currentProduct={recentlyViewedSnapshot(product)}
        section={recentlyViewedSection}
        storeId={store.id}
        storeSlug={store.slug}
      />

      {productPage.promoBlocksEnabled ? (
        <GeneralProductPromoBlocks
          product={product}
          relatedProducts={relatedProducts}
          store={store}
        />
      ) : null}
    </div>
  );
}

function recentlyViewedSnapshot(product: StorefrontProductDetails): RecentlyViewedProduct {
  return {
    compareAtPrice: product.compareAtPrice ? product.compareAtPrice.toString() : null,
    createdAt: product.createdAt.toISOString(),
    hoverImageUrl: product.images[1]?.url ?? null,
    id: product.id,
    imageUrl: product.images[0]?.url ?? null,
    price: product.price.toString(),
    slug: product.slug,
    stockQuantity: product.stockQuantity,
    title: product.title
  };
}

async function GeneralProductBreadcrumb({
  product,
  store
}: {
  product: StorefrontProductDetails;
  store: StorefrontStore;
}) {
  const basePath = await storefrontBasePath(store.slug);
  return (
    <nav className="general-product-breadcrumb" aria-label="Breadcrumb">
      <Link href={basePath || "/"}>Home</Link>
      <span>&gt;</span>
      {product.category ? (
        <Link href={`${basePath}/categories/${product.category.slug}`}>
          {product.category.name}
        </Link>
      ) : (
        <Link href={`${basePath}/products`}>Products</Link>
      )}
      <span>&gt;</span>
      <strong>{product.title}</strong>
    </nav>
  );
}

/**
 * Three navigation cards under the product: its category, then the first two
 * products off the rail above. Every title, image and link comes from a real
 * catalogue record - there are no invented collection names here, so a card
 * always leads somewhere that exists.
 */
async function GeneralProductPromoBlocks({
  product,
  relatedProducts,
  store
}: {
  product: StorefrontProductDetails;
  relatedProducts: StorefrontProduct[];
  store: StorefrontStore;
}) {
  const basePath = await storefrontBasePath(store.slug);
  const category = product.category;
  const neighbours = relatedProducts.slice(0, 2);

  // Without a category or a single neighbour there is nothing truthful left to
  // link to, so the block drops out rather than filling itself with stand-ins.
  if (!category && neighbours.length === 0) {
    return null;
  }

  const categoryBlock = category
    ? {
        href: `${basePath}/categories/${category.slug}`,
        imageUrl: neighbours[0]?.images[0]?.url ?? product.images[1]?.url ?? product.images[0]?.url,
        subtitle: `Browse everything in ${category.name}`,
        title: category.name
      }
    : {
        href: `${basePath}/products`,
        imageUrl: product.images[1]?.url ?? product.images[0]?.url,
        subtitle: `Browse the full catalogue at ${store.name}`,
        title: "All products"
      };

  return (
    <section className="general-product-promo-grid" aria-label="More to explore">
      <PromoBlock
        href={categoryBlock.href}
        imageUrl={categoryBlock.imageUrl}
        subtitle={categoryBlock.subtitle}
        title={categoryBlock.title}
      />
      <div>
        {neighbours.map((neighbour) => (
          <PromoBlock
            href={`${basePath}/products/${neighbour.slug}`}
            imageUrl={neighbour.images[0]?.url}
            key={neighbour.id}
            // The rail can carry a product the seller paired from another
            // category, so the card names the neighbour's own category rather
            // than assuming it shares this product's.
            subtitle={
              neighbour.shortDescription || `Also in ${neighbour.category?.name ?? store.name}`
            }
            title={neighbour.title}
          />
        ))}
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
    <div className="general-product-promo-block">{content}</div>
  );
}

function accordionItems(product: StorefrontProductDetails, storeName: string) {
  return [
    {
      content:
        product.description || product.shortDescription || "Product details will be updated soon.",
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
      content: product.sku
        ? `SKU: ${product.sku}`
        : "Additional product information will appear here when available.",
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
