import { storefrontBasePath } from "../../../../../modules/storefront/base-path";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { getPublicProductTaxonomyItems } from "../../../../../modules/products/product-taxonomy.service";
import { ProductGrid } from "../../../../../modules/storefront/components/product-listing";
import { ShopToolbar } from "../../../../../modules/storefront/components/shop-toolbar";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../../../../modules/storefront/customization";
import { storefrontSectionHref } from "../../../../../modules/storefront/product-sections";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import {
  storefrontCanonicalUrl,
  toMetaDescription
} from "../../../../../modules/seo/page-metadata";
import { encodeUrlPathSegment } from "../../../../../modules/seo/url";
import {
  getStorefrontBySlug,
  getStorefrontCategoryBySlug,
  getStorefrontCategories,
  getStorefrontProductCount,
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../../modules/storefront/resolver";
import type { StorefrontProductSort } from "../../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../../../modules/storefront/themes/theme.service";
import { toProductCardProducts } from "../../../../../modules/storefront/product-card-data";

type StorefrontCategoryProductsPageProps = {
  params: Promise<{
    categorySlug: string;
    slug: string;
  }>;
  searchParams: Promise<{
    availability?: string;
    brand?: string;
    maxPrice?: string;
    minPrice?: string;
    page?: string;
    sort?: string;
    tag?: string;
  }>;
};

/**
 * The canonical points at the bare category, not at the sorted or paginated
 * view the shopper is on. Every filter combination is the same collection in a
 * different order, and the products are listed individually in the sitemap, so
 * there is nothing a crawler reaches only by indexing page 4.
 */
export async function generateMetadata({
  params
}: StorefrontCategoryProductsPageProps): Promise<Metadata> {
  const { categorySlug, slug } = await params;
  const store = await getStorefrontBySlug(slug);

  if (!store) {
    return {};
  }

  const category = await getStorefrontCategoryBySlug(store.id, categorySlug);

  if (!category) {
    return {
      title: `Category not found | ${store.name}`
    };
  }

  const canonical = storefrontCanonicalUrl(
    store,
    `/categories/${encodeUrlPathSegment(category.slug)}`
  );
  const description = toMetaDescription(
    category.description,
    `Shop ${category.name} from ${store.name}.`
  );
  const title = `${category.name} | ${store.name}`;

  return {
    alternates: {
      canonical
    },
    description,
    openGraph: {
      description,
      siteName: store.name,
      title,
      type: "website",
      url: canonical
    },
    title
  };
}

export default async function StorefrontCategoryProductsPage({
  params,
  searchParams
}: StorefrontCategoryProductsPageProps) {
  const { categorySlug, slug } = await params;
  const filters = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const basePath = await storefrontBasePath(store.slug);
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
    brandSlug: shopSettings.enableBrandFilter ? filters.brand : undefined,
    categorySlug: category.slug,
    maxPrice: parsePrice(filters.maxPrice),
    minPrice: parsePrice(filters.minPrice),
    sort,
    tagSlug: shopSettings.enableTagFilter ? filters.tag : undefined
  };
  const [categories, brands, tags, products, totalProducts] = await Promise.all([
    getStorefrontCategories(store.id),
    shopSettings.enableBrandFilter ? getPublicProductTaxonomyItems(store.id, "BRAND") : Promise.resolve([]),
    shopSettings.enableTagFilter ? getPublicProductTaxonomyItems(store.id, "TAG") : Promise.resolve([]),
    getStorefrontProducts(store.id, {
      ...query,
      skip: (currentPage - 1) * productsPerPage,
      take: productsPerPage
    }),
    getStorefrontProductCount(store.id, query)
  ]);
  const totalPages = Math.max(1, Math.ceil(totalProducts / productsPerPage));
  const listingDefaults = settings.advancedSettings.productSections?.listing ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.listing;
  // Same split as the shop page: Product Sections -> Shop / Category Listing
  // supplies the CTA defaults, the Pages panel owns columns, card flags, page
  // size, filters, sorting and spacing. Only the copy is category-specific.
  const listingSection = {
    ...listingDefaults,
    columns: shopSettings.productsPerRow,
    count: productsPerPage,
    enableBadges: shopSettings.enableProductBadges,
    enableComparePrice: shopSettings.enableComparePrice,
    enableHoverImage: shopSettings.enableHoverImage,
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
        {shopSettings.descriptionEnabled ? <span>{listingSection.subtitle}</span> : null}
        {listingSection.ctaText ? (
          <Link href={storefrontSectionHref(basePath, listingSection.ctaLink)}>{listingSection.ctaText}</Link>
        ) : null}
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
          brands={brands}
          categories={categories}
          productCount={totalProducts}
          settings={shopSettings}
          tags={tags}
        />
        {products.length === 0 ? (
          <div className="sf-shop-empty">
            <div aria-hidden="true" />
            <h3>No products found</h3>
            <p>This collection does not have products matching the selected filters.</p>
            <Link href={`${basePath}/categories/${category.slug}`}>Reset Filters</Link>
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
            <div className="sf-pagination" aria-label="Product pagination">
              <PaginationLink
                disabled={currentPage <= 1}
                href={buildCategoryHref(basePath, category.slug, filters, currentPage - 1)}
                label="Previous"
              />
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <PaginationLink
                disabled={currentPage >= totalPages}
                href={buildCategoryHref(basePath, category.slug, filters, currentPage + 1)}
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
  basePath: string,
  categorySlug: string,
  filters: {
    availability?: string;
    brand?: string;
    maxPrice?: string;
    minPrice?: string;
    sort?: string;
    tag?: string;
  },
  page: number
) {
  const params = new URLSearchParams();

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

  return `${basePath}/categories/${categorySlug}${query ? `?${query}` : ""}`;
}

function PaginationLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  if (disabled) {
    return <span aria-disabled="true">{label}</span>;
  }

  return <Link href={href}>{label}</Link>;
}
