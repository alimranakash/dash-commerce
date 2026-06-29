import Link from "next/link";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import {
  getStorefrontCategories,
  getStorefrontProductCount,
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../modules/storefront/resolver";
import type { StorefrontProductSort } from "../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../modules/storefront/templates/registry";

type StorefrontProductsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    brand?: string;
    category?: string;
    page?: string;
    sort?: string;
  }>;
};

const PRODUCTS_PER_PAGE = 12;

export default async function StorefrontProductsPage({
  params,
  searchParams
}: StorefrontProductsPageProps) {
  const { slug } = await params;
  const filters = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const template = getStorefrontTemplateForStore(store);
  const TemplateProductCard = template.components.ProductCard;
  const sort = parseSort(filters.sort);
  const currentPage = parsePage(filters.page);
  const query = {
    categorySlug: filters.category,
    sort
  };
  const [categories, products, totalProducts] = await Promise.all([
    getStorefrontCategories(store.id),
    getStorefrontProducts(store.id, {
      ...query,
      skip: (currentPage - 1) * PRODUCTS_PER_PAGE,
      take: PRODUCTS_PER_PAGE
    }),
    getStorefrontProductCount(store.id, query)
  ]);
  const activeCategory = categories.find((category) => category.slug === filters.category);
  const totalPages = Math.max(1, Math.ceil(totalProducts / PRODUCTS_PER_PAGE));

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <section className="sf-shop-hero" aria-labelledby="shop-title">
        <p>{primaryDomain?.domain ?? `${store.slug}.dash.com`}</p>
        <h1 id="shop-title">Shop {store.name}</h1>
        <span>
          Browse the public catalog. Only available products selected by the seller appear here.
        </span>
      </section>
      <section className="sf-section" aria-labelledby="all-products">
        <div className="sf-section-heading">
          <p>Catalog</p>
          <h2 id="all-products">{activeCategory ? activeCategory.name : "All products"}</h2>
        </div>
        <form className="sf-shop-filters" action={`/s/${store.slug}/products`} method="get">
          <label>
            Category
            <select defaultValue={filters.category ?? ""} name="category">
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          {template.id === "fashion-default" ? (
            <label>
              Brand
              <select defaultValue={filters.brand ?? ""} name="brand">
                <option value="">All brands</option>
                <option value={store.name}>{store.name}</option>
              </select>
            </label>
          ) : null}
          <label>
            Sort
            <select defaultValue={sort} name="sort">
              <option value="newest">Newest</option>
              <option value="price-asc">Price low to high</option>
              <option value="price-desc">Price high to low</option>
            </select>
          </label>
          <button type="submit">Apply</button>
        </form>
        {products.length === 0 ? (
          <div className="sf-empty">
            <h3>No products published yet</h3>
            <p>
              {activeCategory
                ? "No public products are available in this category yet."
                : "This store is getting its catalog ready. Published products will show here."}
            </p>
          </div>
        ) : (
          <>
            <div className="sf-product-grid">
              {products.map((product) => (
                <TemplateProductCard
                  currency={store.currency}
                  key={product.id}
                  product={product}
                  storeSlug={store.slug}
                />
              ))}
            </div>
            <div className="sf-pagination" aria-label="Product pagination">
              <PaginationLink
                disabled={currentPage <= 1}
                href={buildProductsHref(store.slug, filters, currentPage - 1)}
                label="Previous"
              />
              <span>
                Page {currentPage} of {totalPages}
              </span>
              <PaginationLink
                disabled={currentPage >= totalPages}
                href={buildProductsHref(store.slug, filters, currentPage + 1)}
                label="Next"
              />
            </div>
          </>
        )}
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

function parseSort(value: string | undefined): StorefrontProductSort {
  return value === "price-asc" || value === "price-desc" ? value : "newest";
}

function parsePage(value: string | undefined) {
  const page = Number(value);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

function buildProductsHref(
  storeSlug: string,
  filters: {
    brand?: string;
    category?: string;
    sort?: string;
  },
  page: number
) {
  const params = new URLSearchParams();

  if (filters.category) {
    params.set("category", filters.category);
  }

  if (filters.brand) {
    params.set("brand", filters.brand);
  }

  if (filters.sort) {
    params.set("sort", filters.sort);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return `/s/${storeSlug}/products${query ? `?${query}` : ""}`;
}

function PaginationLink({ disabled, href, label }: { disabled: boolean; href: string; label: string }) {
  if (disabled) {
    return <span aria-disabled="true">{label}</span>;
  }

  return <Link href={href}>{label}</Link>;
}
