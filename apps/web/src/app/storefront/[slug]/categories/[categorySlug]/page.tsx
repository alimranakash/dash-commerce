import { notFound } from "next/navigation";
import { StorefrontFooter } from "../../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../../modules/storefront/components/storefront-header";
import {
  getStorefrontCategoryBySlug,
  getStorefrontProducts,
  requireStorefrontBySlug
} from "../../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../../modules/storefront/templates/registry";

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
  const TemplateProductCard = template.components.ProductCard;
  const category = await getStorefrontCategoryBySlug(store.id, categorySlug);

  if (!category) {
    notFound();
  }

  const products = await getStorefrontProducts(store.id, {
    categorySlug: category.slug
  });

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <section className="sf-shop-hero" aria-labelledby="category-title">
        <p>{primaryDomain?.domain ?? `${store.slug}.dash.com`}</p>
        <h1 id="category-title">{category.name}</h1>
        <span>{category.description ?? `Shop products from ${category.name}.`}</span>
      </section>
      <section className="sf-section" aria-labelledby="category-products">
        <div className="sf-section-heading">
          <p>Collection</p>
          <h2 id="category-products">{category.name} products</h2>
        </div>
        {products.length === 0 ? (
          <div className="sf-empty">
            <h3>No products found</h3>
            <p>This category does not have public products yet.</p>
          </div>
        ) : (
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
        )}
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
