import { ProductCard } from "../../../../modules/storefront/components/product-card";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import {
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../modules/storefront/resolver";

type StorefrontProductsPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontProductsPage({ params }: StorefrontProductsPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const products = await getStorefrontProducts(store.id);

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
          <h2 id="all-products">All products</h2>
        </div>
        {products.length === 0 ? (
          <div className="sf-empty">
            <h3>No products published yet</h3>
            <p>This store is getting its catalog ready. Published products will show here.</p>
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
