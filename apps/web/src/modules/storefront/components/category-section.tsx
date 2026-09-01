import { storefrontBasePath } from "../base-path";
import Link from "next/link";

type StorefrontCategory = {
  id: string;
  imageUrl: string | null;
  name: string;
  slug: string;
  description: string | null;
};

type CategorySectionProps = {
  // The /categories page renders this inside the shop-page shell, which already
  // owns the band width, padding and page heading — so it asks for the bare
  // grid. Homepages keep the self-contained section.
  bare?: boolean | undefined;
  categories: StorefrontCategory[];
  storeSlug?: string | undefined;
};

export async function CategorySection({ bare, categories, storeSlug }: CategorySectionProps) {
  const basePath = await storefrontBasePath(storeSlug);
  const body =
    categories.length === 0 ? (
      <div className="sf-empty">
        <h3>Collections coming soon</h3>
        <p>Categories will appear here once the store organizes its products.</p>
      </div>
    ) : (
      <div className="sf-category-grid">
        {categories.map((category) => (
          <article className="sf-category-card" key={category.id}>
            {category.imageUrl ? <img alt="" loading="lazy" src={category.imageUrl} /> : null}
            <span>{category.slug}</span>
            <h3>{category.name}</h3>
            <p>{category.description ?? "Explore products in this collection."}</p>
            {storeSlug ? (
              <Link href={`${basePath}/categories/${category.slug}`}>Explore category</Link>
            ) : null}
          </article>
        ))}
      </div>
    );

  if (bare) {
    return body;
  }

  return (
    <section
      className="sf-section sf-category-section"
      aria-labelledby="storefront-categories"
      id="featured-categories"
    >
      <div className="sf-section-heading">
        <p>Featured Categories</p>
        <h2 id="storefront-categories">Shop by collection</h2>
      </div>
      {body}
    </section>
  );
}
