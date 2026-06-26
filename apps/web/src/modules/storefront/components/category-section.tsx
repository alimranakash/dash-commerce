import Link from "next/link";

type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

type CategorySectionProps = {
  categories: StorefrontCategory[];
  storeSlug?: string;
};

export function CategorySection({ categories, storeSlug }: CategorySectionProps) {
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
      {categories.length === 0 ? (
        <div className="sf-empty">
          <h3>Collections coming soon</h3>
          <p>Categories will appear here once the store organizes its products.</p>
        </div>
      ) : (
        <div className="sf-category-grid">
          {categories.map((category) => (
            <article className="sf-category-card" key={category.id}>
              <span>{category.slug}</span>
              <h3>{category.name}</h3>
              <p>{category.description ?? "Explore products in this collection."}</p>
              {storeSlug ? (
                <Link href={`/s/${storeSlug}/${category.slug}`}>Explore category</Link>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
