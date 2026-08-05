import Link from "next/link";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontProductSectionSettings
} from "../../../../../modules/storefront/customization";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import { GeneralProductPage } from "../../../../../modules/storefront/templates/general-default/product-page";
import {
  getBestSellingStorefrontProducts,
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

export default async function StorefrontProductPage({
  params,
  searchParams
}: StorefrontProductPageProps) {
  const { productSlug, slug } = await params;
  const { cartError } = await searchParams;
  const store = await requireStorefrontBySlug(slug);
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
          <Link className="sf-button" href={`/s/${store.slug}/products`}>
            Back to products
          </Link>
        </section>
        <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
      </main>
    );
  }

  const productSections = settings.advancedSettings.productSections ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections;
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
      <GeneralProductPage
        cartError={cartError}
        product={product}
        ProductDetailExtras={ProductDetailExtras}
        productPage={settings.advancedSettings.productPage ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productPage}
        recentlyViewedSection={recentlyViewedSection}
        relatedProducts={relatedProducts}
        relatedSection={relatedSection}
        store={store}
      />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

// The related rail defaults to "same category", but its Product source can
// point it at any of the catalogue-wide pools instead.
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
