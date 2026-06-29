import { CategorySection } from "../../components/category-section";
import { HeroSection } from "../../components/hero-section";
import { NewsletterCta } from "../../components/newsletter-cta";
import { TrustBadges } from "../../components/trust-badges";
import type { StorefrontTemplateHomepageProps } from "../types";
import { GeneralFooterCta, GeneralProductGrid, GeneralPromoBanner, GeneralSectionWrapper } from "./components";

export function GeneralHomepageSections({
  homeData,
  primaryDomain,
  store
}: StorefrontTemplateHomepageProps) {
  return (
    <>
      <HeroSection primaryDomain={primaryDomain} store={store} />
      <CategorySection categories={homeData.categories} storeSlug={store.slug} />
      <GeneralSectionWrapper eyebrow="Featured" id="featured-products" title={store.themeSetting?.featuredSectionTitle || "Featured products"}>
        <GeneralProductGrid
          currency={store.currency}
          emptyText="This store is preparing its public catalog. Featured products will show here soon."
          emptyTitle="Featured products coming soon"
          products={homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </GeneralSectionWrapper>
      <GeneralSectionWrapper eyebrow="New Arrivals" id="new-arrivals" title="Fresh additions to the store">
        <GeneralProductGrid
          currency={store.currency}
          emptyText="Newly published products will appear here automatically."
          emptyTitle="No new arrivals yet"
          products={homeData.newArrivals}
          storeSlug={store.slug}
        />
      </GeneralSectionWrapper>
      <GeneralPromoBanner storeSlug={store.slug} />
      <GeneralSectionWrapper eyebrow="Best Sellers" id="best-sellers" title="Popular with customers">
        <GeneralProductGrid
          currency={store.currency}
          emptyText="Best sellers will appear once customers start placing orders."
          emptyTitle="Best sellers coming soon"
          products={homeData.bestSellers}
          storeSlug={store.slug}
        />
      </GeneralSectionWrapper>
      <TrustBadges />
      <NewsletterCta />
      <GeneralFooterCta storeName={store.name} storeSlug={store.slug} />
    </>
  );
}
