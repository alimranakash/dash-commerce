import { notFound } from "next/navigation";
import {
  ProductGrid,
  SectionHeader
} from "../../../../../modules/storefront/components/product-listing";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../../../../modules/storefront/customization";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import {
  getStorefrontCategoryBySlug,
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../../../modules/storefront/themes/theme.service";

type StorefrontCategoryProductsPageProps = {
  params: Promise<{
    categorySlug: string;
    slug: string;
  }>;
};

export default async function StorefrontCategoryProductsPage({
  params
}: StorefrontCategoryProductsPageProps) {
  const { categorySlug, slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const template = getStorefrontTemplateForStore(store);
  const settings = await getStorefrontThemeSettings(store.id);
  const category = await getStorefrontCategoryBySlug(store.id, categorySlug);

  if (!category) {
    notFound();
  }

  const products = await getStorefrontProducts(store.id, {
    categorySlug: category.slug
  });
  const listingDefaults = settings.advancedSettings.productSections?.listing ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.listing;
  const listingSection = {
    ...listingDefaults,
    subtitle: category.description ?? `Shop products from ${category.name}.`,
    title: `${category.name} products`
  };

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <section className="sf-shop-hero" aria-labelledby="category-title">
        <p>{primaryDomain?.domain ?? `${store.slug}.dash.com`}</p>
        <h1 id="category-title">{category.name}</h1>
        <span>{category.description ?? `Shop products from ${category.name}.`}</span>
      </section>
      <section className="sf-section general-product-section" aria-labelledby="category-products">
        <SectionHeader
          count={`${products.length} products`}
          ctaHref={`/s/${store.slug}/products`}
          ctaText="Shop all"
          id="category-products"
          subtitle={listingSection.subtitle}
          title={listingSection.title}
        />
        {products.length === 0 ? (
          <div className="sf-empty">
            <h3>No products found</h3>
            <p>This category does not have public products yet.</p>
          </div>
        ) : (
          <ProductGrid
            currency={store.currency}
            products={products}
            section={listingSection}
            storeSlug={store.slug}
          />
        )}
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
