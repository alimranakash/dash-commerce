import { CategorySection } from "../../../../modules/storefront/components/category-section";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import {
  getStorefrontCategories,
  requireStorefrontBySlug
} from "../../../../modules/storefront/resolver";
import { storeSubdomain } from "../../../../lib/host-routing";

type StorefrontCategoriesPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontCategoriesPage({ params }: StorefrontCategoriesPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const categories = await getStorefrontCategories(store.id);

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <section className="sf-shop-hero" aria-labelledby="categories-title">
        <p>{primaryDomain?.domain ?? storeSubdomain(store.slug)}</p>
        <h1 id="categories-title">Categories</h1>
        <span>Browse collections from {store.name}.</span>
      </section>
      <CategorySection categories={categories} storeSlug={store.slug} />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
