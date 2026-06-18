import { requireStorefrontBySlug } from "../../../modules/storefront/resolver";

type StorefrontPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];

  return (
    <main className="storefront-page">
      <section className="storefront-hero" aria-labelledby="storefront-title">
        <p className="eyebrow">{primaryDomain?.domain ?? `${store.slug}.dash.com`}</p>
        <h1 id="storefront-title">{store.name}</h1>
        <p className="lede">
          A storefront foundation is live for this tenant. Products, collections, cart, and checkout
          will arrive in later platform phases.
        </p>
      </section>
      <section className="storefront-section" aria-labelledby="products-title">
        <div>
          <p className="eyebrow">Catalog</p>
          <h2 id="products-title">Products coming soon</h2>
          <p>
            This store is connected to Dash Commerce OS. Product publishing is intentionally not
            implemented yet.
          </p>
        </div>
      </section>
    </main>
  );
}
