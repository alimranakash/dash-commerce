import { ProductCard } from "../../../../modules/storefront/components/product-card";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import {
  getStorefrontCategories,
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../modules/storefront/resolver";
import type { StorefrontProductSort } from "../../../../modules/storefront/resolver";

type StorefrontProductsPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    category?: string;
    sort?: string;
  }>;
};

export default async function StorefrontProductsPage({
  params,
  searchParams
}: StorefrontProductsPageProps) {
  const { slug } = await params;
  const filters = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const sort = parseSort(filters.sort);
  const [categories, products] = await Promise.all([
    getStorefrontCategories(store.id),
    getStorefrontProducts(store.id, {
      categorySlug: filters.category,
      sort
    })
  ]);
  const activeCategory = categories.find((category) => category.slug === filters.category);

  return (
    <main className="sf-page">
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
          <div className="sf-product-grid">
            {products.map((product) => (
              <ProductCard
                currency={store.currency}
                key={product.id}
                product={product}
                storeSlug={store.slug}
              />
            ))}
          </div>
        )}
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

function parseSort(value: string | undefined): StorefrontProductSort {
  return value === "price-asc" || value === "price-desc" ? value : "newest";
}
