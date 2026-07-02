import Link from "next/link";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../../../../modules/storefront/customization";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import { GeneralProductPage } from "../../../../../modules/storefront/templates/general-default/product-page";
import {
  getRelatedStorefrontProducts,
  getStorefrontProductBySlug,
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

  const relatedProducts = await getRelatedStorefrontProducts({
    categoryId: product.categoryId,
    productId: product.id,
    storeId: store.id
  });
  const relatedSection = settings.advancedSettings.productSections?.related ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.related;

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <GeneralProductPage
        cartError={cartError}
        product={product}
        ProductDetailExtras={ProductDetailExtras}
        productPage={settings.advancedSettings.productPage ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productPage}
        relatedProducts={relatedProducts}
        relatedSection={relatedSection}
        store={store}
      />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
