import { NotificationBarSlot } from "../../../../modules/notification-bar/components/notification-bar-slot";
import { storefrontBasePath } from "../../../../modules/storefront/base-path";
import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import type { CSSProperties } from "react";
import { getPublicProductTaxonomyItems } from "../../../../modules/products/product-taxonomy.service";
import { recordSearchQuery } from "../../../../modules/search/search-admin.repository";
import { normalizeSearchRule } from "../../../../modules/search/search-admin.schema";
import {
  getSearchRedirect,
  getSearchResultsForStore
} from "../../../../modules/search/search.service";
import { ProductGrid } from "../../../../modules/storefront/components/product-listing";
import { ShopToolbar } from "../../../../modules/storefront/components/shop-toolbar";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../../../modules/storefront/customization";
import type { StorefrontShopPageSettings } from "../../../../modules/storefront/customization";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { StorefrontPagination } from "../../../../modules/storefront/components/storefront-pagination";
import {
  getStorefrontCategories,
  getStorefrontProductCount,
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../modules/storefront/resolver";
import type { StorefrontProductSort } from "../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../../modules/storefront/themes/theme.service";
import { storeSubdomain } from "../../../../lib/host-routing";
import { toProductCardProducts } from "../../../../modules/storefront/product-card-data";

type StorefrontSearchPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<StorefrontSearchFilters>;
};

type StorefrontSearchFilters = {
  availability?: string;
  brand?: string;
  category?: string;
  maxPrice?: string;
  minPrice?: string;
  page?: string;
  q?: string;
  sort?: string;
  tag?: string;
};

export default async function StorefrontSearchPage({
  params,
  searchParams
}: StorefrontSearchPageProps) {
  const { slug } = await params;
  const filters = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const basePath = await storefrontBasePath(store.slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const query = (filters.q ?? "").trim();
  const template = getStorefrontTemplateForStore(store);
  const settings = await getStorefrontThemeSettings(store.id);
  const shopSettings =
    settings.advancedSettings.shopPage ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.shopPage;
  const searchSettings = withRelevanceSort(shopSettings);
  const sort = parseSort(filters.sort);
  const currentPage = parsePage(filters.page);
  const productsPerPage = Math.round(shopSettings.productsPerPage);

  if (!query) {
    return (
      <EmptySearchPage
        primaryDomain={primaryDomain?.domain}
        store={store}
        templateId={template.id}
      />
    );
  }

  // Checked before any product query: a redirected term never renders results,
  // so running the search first would be wasted work.
  const redirectTarget = await getSearchRedirect(store.id, query);

  if (redirectTarget) {
    redirect(redirectTarget);
  }

  const productQuery = {
    availability: parseAvailability(filters.availability),
    brandSlug: shopSettings.enableBrandFilter ? filters.brand : undefined,
    categorySlug: filters.category,
    maxPrice: parsePrice(filters.maxPrice),
    minPrice: parsePrice(filters.minPrice),
    search: query,
    sort,
    tagSlug: shopSettings.enableTagFilter ? filters.tag : undefined
  };
  // `getSearchResultsForStore` is request-cached, so asking it for the strategy
  // here does not cost a second full-text query on top of the two below.
  const [categories, brands, tags, products, totalProducts, searchResult] = await Promise.all([
    getStorefrontCategories(store.id),
    shopSettings.enableBrandFilter
      ? getPublicProductTaxonomyItems(store.id, "BRAND")
      : Promise.resolve([]),
    shopSettings.enableTagFilter
      ? getPublicProductTaxonomyItems(store.id, "TAG")
      : Promise.resolve([]),
    getStorefrontProducts(store.id, {
      ...productQuery,
      skip: (currentPage - 1) * productsPerPage,
      take: productsPerPage
    }),
    getStorefrontProductCount(store.id, productQuery),
    getSearchResultsForStore(store.id, query)
  ]);
  const totalPages = Math.max(1, Math.ceil(totalProducts / productsPerPage));

  // Recorded after the response so a shopper never waits on analytics, and only
  // for the first page — paging through one search is still one search.
  if (currentPage === 1) {
    after(async () => {
      await recordSearchQuery(store.id, normalizeSearchRule(query), totalProducts);
    });
  }

  const hasActiveFilters = Boolean(
    filters.availability ||
    filters.brand ||
    filters.category ||
    filters.maxPrice ||
    filters.minPrice ||
    filters.tag
  );
  const listingSection = {
    ...(settings.advancedSettings.productSections?.search ??
      DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.search),
    columns: shopSettings.productsPerRow,
    count: productsPerPage,
    enableBadges: shopSettings.enableProductBadges,
    enableComparePrice: shopSettings.enableComparePrice,
    enableHoverImage: shopSettings.enableHoverImage
  };
  const gridId = "storefront-search-product-grid";

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <NotificationBarSlot anchor="top" store={store} surface="other" />
      <section className="sf-shop-page-header" aria-labelledby="search-title">
        <p>Search results</p>
        <span>{resultSummary(query, totalProducts, hasActiveFilters)}</span>
      </section>
      <section
        className={`sf-shop-page sf-shop-page-${shopSettings.widthMode}`}
        style={
          {
            "--shop-grid-gap": `${shopSettings.gridSpacing}px`,
            "--shop-section-spacing": `${shopSettings.sectionSpacing}px`
          } as CSSProperties
        }
        aria-labelledby="search-title"
      >
        <h1 className="sr-only" id="search-title">
          Search results for {query}
        </h1>

        {/*
          Fuzzy matching is the last resort in the search service, so reaching it
          means nothing the shopper actually typed exists in the catalogue. Saying
          so prevents the results below from reading like exact matches.
        */}
        {searchResult.strategy === "fuzzy" ? (
          <p className="sf-search-notice">
            No exact match for <strong>{query}</strong> — showing the closest products we carry.
          </p>
        ) : null}

        <ShopToolbar
          brands={brands}
          categories={categories}
          productCount={totalProducts}
          settings={searchSettings}
          tags={tags}
        />

        {products.length === 0 ? (
          <div className="sf-shop-empty">
            <div aria-hidden="true" />
            <h3>No products found</h3>
            <p>
              {hasActiveFilters
                ? `No product matching "${query}" fits the filters you picked.`
                : `We could not find anything for "${query}". Try a shorter or more general word.`}
            </p>
            <Link href={`${basePath}/products`}>Browse all products</Link>
          </div>
        ) : (
          <>
            <ProductGrid
              cardVariant={template.productCardVariant}
              currency={store.currency}
              gridId={gridId}
              products={toProductCardProducts(products)}
              section={listingSection}
              storeId={store.id}
              storeSlug={store.slug}
            />
            <StorefrontPagination
              buildHref={(page) => buildSearchHref(basePath, filters, page)}
              currentPage={currentPage}
              itemNoun="results"
              label="Search result pagination"
              perPage={productsPerPage}
              totalItems={totalProducts}
              totalPages={totalPages}
            />
          </>
        )}
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

type EmptySearchPageProps = {
  primaryDomain: string | undefined;
  store: Awaited<ReturnType<typeof requireStorefrontBySlug>>;
  templateId: string;
};

/**
 * Landing on `/search` with no query. The header already carries the search
 * field on every template, so this only has to explain itself and offer a way
 * into the catalogue.
 */
async function EmptySearchPage({ primaryDomain, store, templateId }: EmptySearchPageProps) {
  const basePath = await storefrontBasePath(store.slug);
  return (
    <main className="sf-page" data-storefront-template={templateId}>
      <StorefrontHeader store={store} />
      <NotificationBarSlot anchor="top" store={store} surface="other" />
      <section className="sf-shop-page-header" aria-labelledby="search-title">
        <p>Search</p>
        <span>{primaryDomain ?? storeSubdomain(store.slug)}</span>
      </section>
      <section className="sf-shop-page sf-shop-page-boxed" aria-labelledby="search-title">
        <h1 className="sr-only" id="search-title">
          Search
        </h1>
        <div className="sf-shop-empty">
          <div aria-hidden="true" />
          <h3>Search the catalog</h3>
          <p>Type a product name, category or SKU in the search box above.</p>
          <Link href={`${basePath}/products`}>Browse all products</Link>
        </div>
      </section>
      <StorefrontFooter primaryDomain={primaryDomain} store={store} />
    </main>
  );
}

/**
 * Zero results has two different meanings worth separating: the catalogue holds
 * nothing like the query, or it does and the shopper's own filters hid it. The
 * second is recoverable by clearing a filter, so it must not read as the first.
 */
function resultSummary(query: string, totalProducts: number, hasActiveFilters: boolean) {
  if (totalProducts > 0) {
    return `${totalProducts} ${totalProducts === 1 ? "result" : "results"} for "${query}"`;
  }

  return hasActiveFilters
    ? `No result for "${query}" with these filters`
    : `Nothing matched "${query}"`;
}

/**
 * Puts relevance at the head of the sort list and makes it the default.
 *
 * Seller settings cannot carry relevance — it is filtered out of the persisted
 * whitelist — so the search page grants it here, for this render only.
 */
function withRelevanceSort(settings: StorefrontShopPageSettings): StorefrontShopPageSettings {
  return {
    ...settings,
    defaultSort: "relevance",
    sortOptions: ["relevance", ...settings.sortOptions.filter((option) => option !== "relevance")]
  };
}

function parseAvailability(value: string | undefined): "in-stock" | "out-of-stock" | undefined {
  return value === "in-stock" || value === "out-of-stock" ? value : undefined;
}

function parsePrice(value: string | undefined) {
  const price = Number(value);

  return Number.isFinite(price) && price >= 0 ? price : undefined;
}

function parseSort(value: string | undefined): StorefrontProductSort {
  return [
    "alpha-asc",
    "alpha-desc",
    "best-selling",
    "featured",
    "newest",
    "price-asc",
    "price-desc"
  ].includes(value ?? "")
    ? (value as StorefrontProductSort)
    : "relevance";
}

function parsePage(value: string | undefined) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function buildSearchHref(basePath: string, filters: StorefrontSearchFilters, page: number) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.availability) {
    params.set("availability", filters.availability);
  }

  if (filters.brand) {
    params.set("brand", filters.brand);
  }

  if (filters.tag) {
    params.set("tag", filters.tag);
  }

  if (filters.minPrice) {
    params.set("minPrice", filters.minPrice);
  }

  if (filters.maxPrice) {
    params.set("maxPrice", filters.maxPrice);
  }

  if (filters.sort) {
    params.set("sort", filters.sort);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return `${basePath}/search${query ? `?${query}` : ""}`;
}
