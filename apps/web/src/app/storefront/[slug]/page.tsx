import { CategorySection } from "../../../modules/storefront/components/category-section";
import { FeaturedProducts } from "../../../modules/storefront/components/featured-products";
import { HeroSection } from "../../../modules/storefront/components/hero-section";
import { NewsletterCta } from "../../../modules/storefront/components/newsletter-cta";
import { StorefrontFooter } from "../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../modules/storefront/components/storefront-header";
import { TrustBadges } from "../../../modules/storefront/components/trust-badges";
import {
  getStorefrontHomeData,
  requireStorefrontBySlug
} from "../../../modules/storefront/resolver";

type StorefrontPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const homeData = await getStorefrontHomeData(store.id);

  return (
    <main className="sf-page">
      <StorefrontHeader store={store} />
      <HeroSection primaryDomain={primaryDomain?.domain} store={store} />
      <CategorySection categories={homeData.categories} storeSlug={store.slug} />
      <FeaturedProducts
        currency={store.currency}
        heading={store.themeSetting?.featuredSectionTitle}
        products={homeData.featuredProducts}
        storeSlug={store.slug}
      />
      <TrustBadges />
      <NewsletterCta />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
