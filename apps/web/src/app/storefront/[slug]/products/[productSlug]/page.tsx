import { storefrontBasePath } from "../../../../../modules/storefront/base-path";
import type { Metadata } from "next";
import Link from "next/link";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontProductSectionSettings
} from "../../../../../modules/storefront/customization";
import { NotificationBarSlot } from "../../../../../modules/notification-bar/components/notification-bar-slot";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import { GeneralProductPage } from "../../../../../modules/storefront/templates/general-default/product-page";
import {
  storefrontCanonicalOrigin,
  storefrontCanonicalUrl,
  toMetaDescription
} from "../../../../../modules/seo/page-metadata";
import { encodeUrlPathSegment, toAbsoluteUrl } from "../../../../../modules/seo/url";
import {
  getBestSellingStorefrontProducts,
  getStorefrontBySlug,
  getRelatedStorefrontProducts,
  getStorefrontProductBySlug,
  getStorefrontProducts,
  getTrendingStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../../../modules/storefront/themes/theme.service";

type StorefrontProductPageProps = {
  params: Promise<{
    productSlug: string;
    slug: string;
  }>;
  searchParams: Promise<{
    cartError?: string;
  }>;
};

/**
 * A product's own title, description and canonical.
 *
 * Without this the page inherits the layout's metadata, so every product on
 * the store canonicalises to the homepage — and a sitemap listing those
 * products would be submitting URLs that each disclaim themselves.
 */
export async function generateMetadata({ params }: StorefrontProductPageProps): Promise<Metadata> {
  const { productSlug, slug } = await params;
  const store = await getStorefrontBySlug(slug);

  if (!store) {
    return {};
  }

  const product = await getStorefrontProductBySlug(store.id, productSlug);

  // Unlike most storefront routes this one renders an "unavailable" panel
  // rather than calling notFound(), so the noindex has to be explicit or that
  // panel is what a crawler files under this URL.
  if (!product) {
    return {
      robots: {
        follow: true,
        index: false
      },
      title: `Product unavailable | ${store.name}`
    };
  }

  const canonical = storefrontCanonicalUrl(
    store,
    `/products/${encodeUrlPathSegment(product.slug)}`
  );
  const description = toMetaDescription(
    product.description,
    `${product.title} from ${store.name}.`
  );
  const title = `${product.title} | ${store.name}`;
  const leadImage = product.images[0]?.url;
  const imageUrl = leadImage ? toAbsoluteUrl(storefrontCanonicalOrigin(store), leadImage) : null;

  return {
    alternates: {
      canonical
    },
    description,
    openGraph: {
      description,
      ...(imageUrl ? { images: [imageUrl] } : {}),
      siteName: store.name,
      title,
      type: "website",
      url: canonical
    },
    title
  };
}

export default async function StorefrontProductPage({
  params,
  searchParams
}: StorefrontProductPageProps) {
  const { productSlug, slug } = await params;
  const { cartError } = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const basePath = await storefrontBasePath(store.slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const template = getStorefrontTemplateForStore(store);
  const ProductDetailExtras = template.components.ProductDetailExtras;
  const settings = await getStorefrontThemeSettings(store.id);
  const product = await getStorefrontProductBySlug(store.id, productSlug);

  if (!product) {
    return (
      <main className="sf-page" data-storefront-template={template.id}>
        <StorefrontHeader store={store} />
        <section className="sf-missing" aria-labelledby="product-404">
          <p>Product unavailable</p>
          <h1 id="product-404">This product is not available.</h1>
          <span>It may have been unpublished, archived, or moved by the seller.</span>
          <Link className="sf-button" href={`${basePath}/products`}>
            Back to products
          </Link>
        </section>
        <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
      </main>
    );
  }

  const productSections =
    settings.advancedSettings.productSections ??
    DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections;
  const relatedSection = productSections.related;
  const recentlyViewedSection = productSections.recentlyViewed;
  const relatedProducts = await getProductSectionProducts({
    categoryId: product.categoryId,
    productId: product.id,
    section: relatedSection,
    storeId: store.id
  });

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      {/* The two anchors the page itself owns. The other two — either side of
        the add-to-cart button — live inside the template, which is the only
        place that knows where its own buy box is. */}
      <NotificationBarSlot anchor="top" store={store} surface="product" />
      <GeneralProductPage
        cardVariant={template.productCardVariant}
        cartError={cartError}
        product={product}
        ProductDetailExtras={ProductDetailExtras}
        productPage={
          settings.advancedSettings.productPage ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productPage
        }
        recentlyViewedSection={recentlyViewedSection}
        relatedProducts={relatedProducts}
        relatedSection={relatedSection}
        store={store}
      />
      <NotificationBarSlot anchor="below_details" store={store} surface="product" />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

// The related rail defaults to the seller's own pairings, then what this
// store's shoppers bought alongside this product, then the rest of its
// category - see getRelatedStorefrontProducts. Its Product source can point it
// at any of the catalogue-wide pools instead, and then none of that applies.
async function getProductSectionProducts(input: {
  categoryId: string | null;
  productId: string;
  section: StorefrontProductSectionSettings;
  storeId: string;
}) {
  const take = Math.round(input.section.count);

  if (input.section.source === "best-sellers" || input.section.source === "trending") {
    const products =
      input.section.source === "trending"
        ? await getTrendingStorefrontProducts(input.storeId, take + 1)
        : await getBestSellingStorefrontProducts(input.storeId, take + 1);

    if (products.length > 0) {
      return products.filter((item) => item.id !== input.productId).slice(0, take);
    }
  }

  if (input.section.source === "new-arrivals") {
    const products = await getStorefrontProducts(input.storeId, { sort: "newest", take: take + 1 });

    return products.filter((item) => item.id !== input.productId).slice(0, take);
  }

  if (input.section.source !== "related") {
    const products = await getStorefrontProducts(input.storeId, { take: take + 1 });

    return products.filter((item) => item.id !== input.productId).slice(0, take);
  }

  return getRelatedStorefrontProducts({
    categoryId: input.categoryId,
    productId: input.productId,
    storeId: input.storeId,
    take
  });
}
