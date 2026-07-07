import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { ProductGrid } from "../../../../../modules/storefront/components/product-listing";
import { ShopToolbar } from "../../../../../modules/storefront/components/shop-toolbar";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../../../../modules/storefront/customization";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import {
  getStorefrontCategoryBySlug,
  getStorefrontCategories,
  getStorefrontProductCount,
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../../modules/storefront/resolver";
import type { StorefrontProductSort } from "../../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../../../modules/storefront/themes/theme.service";

type StorefrontCategoryProductsPageProps = {
  params: Promise<{
    categorySlug: string;
    slug: string;
  }>;
  searchParams: Promise<{
    availability?: string;
    maxPrice?: string;
    minPrice?: string;
    page?: string;
    sort?: string;
  }>;
};

export default async function StorefrontCategoryProductsPage({
  params,
  searchParams
}: StorefrontCategoryProductsPageProps) {
  const { categorySlug, slug } = await params;
  const filters = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const template = getStorefrontTemplateForStore(store);
  const settings = await getStorefrontThemeSettings(store.id);
  const shopSettings = settings.advancedSettings.shopPage ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.shopPage;
  const category = await getStorefrontCategoryBySlug(store.id, categorySlug);

  if (!category) {
    notFound();
  }

  const sort = parseSort(filters.sort, shopSettings.defaultSort);
  const currentPage = parsePage(filters.page);
  const productsPerPage = Math.round(shopSettings.productsPerPage);
  const query = {
    availability: parseAvailability(filters.availability),
    categorySlug: category.slug,
    maxPrice: parsePrice(filters.maxPrice),
    minPrice: parsePrice(filters.minPrice),
    sort
  };
  const [categories, products, totalProducts] = await Promise.all([
    getStorefrontCategories(store.id),
    getStorefrontProducts(store.id, {
      ...query,
      skip: (currentPage - 1) * productsPerPage,
      take: productsPerPage
    }),
    getStorefrontProductCount(store.id, query)
  ]);
  const totalPages = Math.max(1, Math.ceil(totalProducts / productsPerPage));
  const listingDefaults = settings.advancedSettings.productSections?.listing ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.listing;
  const listingSection = {
    ...listingDefaults,
    columns: shopSettings.productsPerRow,
    count: productsPerPage,
    enableBadges: shopSettings.enableProductBadges,
    enableComparePrice: shopSettings.enableComparePrice,
    enableHoverImage: shopSettings.enableHoverImage,
    enableVariants: shopSettings.enableProductColorCount,
    mode: "grid" as const,
    subtitle: category.description ?? `Shop products from ${category.name}.`,
    title: `${category.name} products`
  };
  const gridId = "storefront-category-product-grid";

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <section className="sf-shop-page-header" aria-labelledby="category-title">
        {category.imageUrl ? (
          <img alt="" className="sf-shop-page-header-image" loading="lazy" src={category.imageUrl} />
        ) : null}
        <p>Collection</p>
        {shopSettings.descriptionEnabled ? <span>{category.description ?? `Shop products from ${category.name}.`}</span> : null}
      </section>
      <section
        className={`sf-shop-page sf-shop-page-${shopSettings.widthMode}`}
        style={{
          "--shop-grid-gap": `${shopSettings.gridSpacing}px`,
          "--shop-section-spacing": `${shopSettings.sectionSpacing}px`
        } as CSSProperties}
        aria-labelledby="category-title"
      >
        <h1 className="sr-only" id="category-title">{listingSection.title}</h1>
        <ShopToolbar
          categories={categories}
          productCount={totalProducts}
          settings={shopSettings}
          storeName={store.name}
        />
        {products.length === 0 ? (
          <div className="sf-shop-empty">
            <div aria-hidden="true" />
            <h3>No products found</h3>
            <p>This collection does not have products matching the selected filters.</p>
            <a href={`/s/${store.slug}/categories/${category.slug}`}>Reset Filters</a>
          </div>
        ) : (
          <>
            <ProductGrid
              currency={store.currency}
              gridId={gridId}
              products={products}
              section={listingSection}
              storeSlug={store.slug}
            />
            <div className="sf-pagination" aria-label="Product pagination">
              <PaginationLink
                disabled={currentPage <= 1}
                href={buildCategoryHref(store.slug, category.slug, filters, currentPage - 1)}
                label="Previous"
              />
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <PaginationLink
                disabled={currentPage >= totalPages}
                href={buildCategoryHref(store.slug, category.slug, filters, currentPage + 1)}
                label={shopSettings.paginationMode === "load-more" ? "Load More" : "Next"}
              />
            </div>
          </>
        )}
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

function parseAvailability(value: string | undefined): "in-stock" | "out-of-stock" | undefined {
  return value === "in-stock" || value === "out-of-stock" ? value : undefined;
}

function parsePage(value: string | undefined) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parsePrice(value: string | undefined) {
  const price = Number(value);

  return Number.isFinite(price) && price >= 0 ? price : undefined;
}

function parseSort(value: string | undefined, fallback: StorefrontProductSort): StorefrontProductSort {
  return ["alpha-asc", "alpha-desc", "best-selling", "featured", "newest", "price-asc", "price-desc"].includes(value ?? "")
    ? (value as StorefrontProductSort)
    : fallback;
}

function buildCategoryHref(
  storeSlug: string,
  categorySlug: string,
  filters: {
    availability?: string;
    maxPrice?: string;
    minPrice?: string;
    sort?: string;
  },
  page: number
) {
  const params = new URLSearchParams();

  if (filters.availability) {
    params.set("availability", filters.availability);
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

  return `/s/${storeSlug}/categories/${categorySlug}${query ? `?${query}` : ""}`;
}

function PaginationLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  if (disabled) {
    return <span aria-disabled="true">{label}</span>;
  }

  return <Link href={href}>{label}</Link>;
}
