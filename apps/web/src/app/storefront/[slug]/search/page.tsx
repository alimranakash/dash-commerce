import {
  ProductGrid,
  SectionHeader
} from "../../../../modules/storefront/components/product-listing";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../../../modules/storefront/customization";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import {
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../../modules/storefront/themes/theme.service";

type StorefrontSearchPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function StorefrontSearchPage({
  params,
  searchParams
}: StorefrontSearchPageProps) {
  const { slug } = await params;
  const { q = "" } = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const query = q.trim();
  const template = getStorefrontTemplateForStore(store);
  const settings = await getStorefrontThemeSettings(store.id);
  const products = query
    ? await getStorefrontProducts(store.id, {
        search: query
      })
    : [];

  const searchDefaults = settings.advancedSettings.productSections?.search ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.search;
  const searchSection = {
    ...searchDefaults,
    subtitle: query ? `Products matching "${query}".` : searchDefaults.subtitle,
    title: query ? `Results for "${query}"` : searchDefaults.title
  };

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <section className="sf-shop-hero" aria-labelledby="search-title">
        <p>{primaryDomain?.domain ?? `${store.slug}.dash.com`}</p>
        <h1 id="search-title">Search products</h1>
        <span>Find products by title or SKU.</span>
      </section>
      <section className="sf-section general-product-section" aria-labelledby="search-results">
        <form className="sf-search-form" action={`/s/${store.slug}/search`} method="get">
          <label>
            Search
            <input
              defaultValue={query}
              name="q"
              placeholder="Search products or SKU"
              type="search"
            />
          </label>
          <button type="submit">Search</button>
        </form>
        <SectionHeader
          count={query ? `${products.length} results` : undefined}
          ctaHref={`/s/${store.slug}/products`}
          ctaText="Shop all"
          id="search-results"
          subtitle={searchSection.subtitle}
          title={searchSection.title}
        />
        {!query ? (
          <div className="sf-empty">
            <h3>Search the catalog</h3>
            <p>Enter a product title or SKU to find matching public products.</p>
          </div>
        ) : products.length === 0 ? (
          <div className="sf-empty">
            <h3>No products found</h3>
            <p>Try another keyword or browse the full shop.</p>
          </div>
        ) : (
          <ProductGrid
            currency={store.currency}
            products={products}
            section={searchSection}
            storeSlug={store.slug}
          />
        )}
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
