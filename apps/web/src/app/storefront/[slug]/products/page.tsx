import { storefrontBasePath } from "../../../../modules/storefront/base-path";
import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";
import { NotificationBarSlot } from "../../../../modules/notification-bar/components/notification-bar-slot";
import { barAppearsAt } from "../../../../modules/notification-bar/notification-bar.render";
import { resolveNotificationBar } from "../../../../modules/notification-bar/notification-bar.service";
import { getPublicProductTaxonomyItems } from "../../../../modules/products/product-taxonomy.service";
import { ProductGrid } from "../../../../modules/storefront/components/product-listing";
import { ShopToolbar } from "../../../../modules/storefront/components/shop-toolbar";
import { StorefrontPagination } from "../../../../modules/storefront/components/storefront-pagination";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../../../modules/storefront/customization";
import { storefrontSectionHref } from "../../../../modules/storefront/product-sections";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { storefrontCanonicalUrl, toMetaDescription } from "../../../../modules/seo/page-metadata";
import {
  getStorefrontBySlug,
  getStorefrontCategories,
  getStorefrontProductCount,
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../modules/storefront/resolver";
import type { StorefrontProductSort } from "../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../../modules/storefront/themes/theme.service";
import { toProductCardProducts } from "../../../../modules/storefront/product-card-data";

type StorefrontProductsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    availability?: string;
    brand?: string;
    category?: string;
    maxPrice?: string;
    minPrice?: string;
    page?: string;
    sort?: string;
    tag?: string;
  }>;
};

/** Every sort, filter and page of the shop canonicalises to the bare list. */
export async function generateMetadata({ params }: StorefrontProductsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStorefrontBySlug(slug);

  if (!store) {
    return {};
  }

  const canonical = storefrontCanonicalUrl(store, "/products");
  const description = toMetaDescription(
    store.setting?.tagline,
    `Browse every product available from ${store.name}.`
  );
  const title = `All products | ${store.name}`;

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

export default async function StorefrontProductsPage({
  params,
  searchParams
}: StorefrontProductsPageProps) {
  const { slug } = await params;
  const filters = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const basePath = await storefrontBasePath(store.slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const template = getStorefrontTemplateForStore(store);
  const settings = await getStorefrontThemeSettings(store.id);
  const shopSettings =
    settings.advancedSettings.shopPage ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.shopPage;
  const sort = parseSort(filters.sort, shopSettings.defaultSort);
  const currentPage = parsePage(filters.page);
  const productsPerPage = Math.round(shopSettings.productsPerPage);
  const query = {
    availability: parseAvailability(filters.availability),
    brandSlug: shopSettings.enableBrandFilter ? filters.brand : undefined,
    categorySlug: filters.category,
    maxPrice: parsePrice(filters.maxPrice),
    minPrice: parsePrice(filters.minPrice),
    sort,
    tagSlug: shopSettings.enableTagFilter ? filters.tag : undefined
  };
  const [categories, brands, tags, products, totalProducts] = await Promise.all([
    getStorefrontCategories(store.id),
    shopSettings.enableBrandFilter
      ? getPublicProductTaxonomyItems(store.id, "BRAND")
      : Promise.resolve([]),
    shopSettings.enableTagFilter
      ? getPublicProductTaxonomyItems(store.id, "TAG")
      : Promise.resolve([]),
    getStorefrontProducts(store.id, {
      ...query,
      skip: (currentPage - 1) * productsPerPage,
      take: productsPerPage
    }),
    getStorefrontProductCount(store.id, query)
  ]);
  const activeCategory = categories.find((category) => category.slug === filters.category);
  const totalPages = Math.max(1, Math.ceil(totalProducts / productsPerPage));
  // Product Sections -> Shop / Category Listing supplies the card CTA defaults;
  // everything the Pages panel exposes (columns, card flags, page size, header
  // copy) is owned here so those controls are never saved-and-ignored.
  const listingSection = {
    ...(settings.advancedSettings.productSections?.listing ??
      DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.listing),
    columns: shopSettings.productsPerRow,
    count: productsPerPage,
    enableBadges: shopSettings.enableProductBadges,
    enableComparePrice: shopSettings.enableComparePrice,
    enableHoverImage: shopSettings.enableHoverImage,
    subtitle: activeCategory ? (activeCategory.description ?? "") : shopSettings.description,
    title: activeCategory ? activeCategory.name : shopSettings.pageTitle
  };
  const gridId = "storefront-shop-product-grid";
  const pageDescription = listingSection.subtitle;
  // Asked here rather than left to the slot, because an `in_grid` bar is a *cell*
  // and a slot that renders nothing would still occupy one. Free: the resolver is
  // request-cached, so this is the same read the anchors above already paid for.
  const notificationBar = await resolveNotificationBar(store);
  const barInGrid = notificationBar
    ? barAppearsAt(notificationBar, "shop", "in_grid")
      ? notificationBar.gridAfter
      : null
    : null;

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <NotificationBarSlot anchor="top" store={store} surface="shop" />
      <section className="sf-shop-page-header" aria-labelledby="shop-title">
        <p>{listingSection.title}</p>
        {shopSettings.descriptionEnabled && pageDescription ? <span>{pageDescription}</span> : null}
        {listingSection.ctaText ? (
          <Link href={storefrontSectionHref(basePath, listingSection.ctaLink)}>
            {listingSection.ctaText}
          </Link>
        ) : null}
      </section>
      <section
        className={`sf-shop-page sf-shop-page-${shopSettings.widthMode}`}
        style={
          {
            "--shop-grid-gap": `${shopSettings.gridSpacing}px`,
            "--shop-section-spacing": `${shopSettings.sectionSpacing}px`
          } as CSSProperties
        }
        aria-labelledby="shop-title"
      >
        <h1 className="sr-only" id="shop-title">
          {listingSection.title}
        </h1>
        <ShopToolbar
          brands={brands}
          categories={categories}
          productCount={totalProducts}
          settings={shopSettings}
          tags={tags}
        />
        <NotificationBarSlot anchor="above_grid" store={store} surface="shop" />
        {products.length === 0 ? (
          <div className="sf-shop-empty">
            <div aria-hidden="true" />
            <h3>No products found</h3>
            <p>
              {activeCategory
                ? "No public products are available in this collection yet."
                : "Try changing filters or sorting to find more products."}
            </p>
            <Link href={`${basePath}/products`}>Reset Filters</Link>
          </div>
        ) : (
          <>
            <ProductGrid
              cardVariant={template.productCardVariant}
              currency={store.currency}
              gridId={gridId}
              /* A bar that is a cell in the grid rather than a band above it.
                 Passed in as a rendered node so `ProductGrid` stays
                 presentational and knows nothing about announcements: it is
                 handed something to place and the count to place it after. The
                 slot itself renders nothing unless the seller chose `in_grid`. */
              inlineSlot={
                barInGrid === null ? null : (
                  <NotificationBarSlot anchor="in_grid" store={store} surface="shop" />
                )
              }
              inlineSlotAfter={barInGrid}
              products={toProductCardProducts(products)}
              section={listingSection}
              storeId={store.id}
              storeSlug={store.slug}
            />
            <StorefrontPagination
              buildHref={(page) => buildProductsHref(basePath, filters, page)}
              currentPage={currentPage}
              label="Product pagination"
              mode={shopSettings.paginationMode}
              perPage={productsPerPage}
              totalItems={totalProducts}
              totalPages={totalPages}
            />
          </>
        )}
      </section>
      <NotificationBarSlot anchor="before_footer" store={store} surface="shop" />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

function parseAvailability(value: string | undefined): "in-stock" | "out-of-stock" | undefined {
  return value === "in-stock" || value === "out-of-stock" ? value : undefined;
}

function parsePrice(value: string | undefined) {
  const price = Number(value);

  return Number.isFinite(price) && price >= 0 ? price : undefined;
}

function parseSort(
  value: string | undefined,
  fallback: StorefrontProductSort
): StorefrontProductSort {
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
    : fallback;
}

function parsePage(value: string | undefined) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function buildProductsHref(
  basePath: string,
  filters: {
    availability?: string;
    brand?: string;
    category?: string;
    maxPrice?: string;
    minPrice?: string;
    sort?: string;
    tag?: string;
  },
  page: number
) {
  const params = new URLSearchParams();

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.availability) {
    params.set("availability", filters.availability);
  }

  if (filters.minPrice) {
    params.set("minPrice", filters.minPrice);
  }

  if (filters.maxPrice) {
    params.set("maxPrice", filters.maxPrice);
  }

  if (filters.brand) {
    params.set("brand", filters.brand);
  }

  if (filters.tag) {
    params.set("tag", filters.tag);
  }

  if (filters.sort) {
    params.set("sort", filters.sort);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return `${basePath}/products${query ? `?${query}` : ""}`;
}
