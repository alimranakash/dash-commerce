import { CategorySection } from "../../components/category-section";
import { HeroSection } from "../../components/hero-section";
import { NewsletterCta } from "../../components/newsletter-cta";
import type { StorefrontTemplateHomepageProps } from "../types";
import {
  ElectronicsBrandStrip,
  ElectronicsDealsBanner,
  ElectronicsProductGrid,
  ElectronicsSection,
  ElectronicsWarrantyBadges
} from "./components";

export function ElectronicsHomepageSections({
  homeData,
  primaryDomain,
  store
}: StorefrontTemplateHomepageProps) {
  return (
    <>
      <HeroSection primaryDomain={primaryDomain} store={store} />
      <ElectronicsSection eyebrow="Featured Gadgets" id="electronics-featured" title="Featured tech picks">
        <ElectronicsProductGrid
          currency={store.currency}
          emptyText="Featured gadgets will appear when products are published."
          emptyTitle="Featured gadgets coming soon"
          products={homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <CategorySection categories={homeData.categories} storeSlug={store.slug} />
      <ElectronicsSection eyebrow="New Arrivals" id="electronics-new-arrivals" title="Latest devices and accessories">
        <ElectronicsProductGrid
          currency={store.currency}
          emptyText="New electronics will appear here automatically."
          emptyTitle="No new arrivals yet"
          products={homeData.newArrivals}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <ElectronicsSection eyebrow="Best Sellers" id="electronics-best-sellers" title="Most wanted products">
        <ElectronicsProductGrid
          currency={store.currency}
          emptyText="Best sellers will appear after customers place orders."
          emptyTitle="Best sellers coming soon"
          products={homeData.bestSellers}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <ElectronicsDealsBanner storeSlug={store.slug} />
      <ElectronicsBrandStrip />
      <ElectronicsWarrantyBadges />
      <NewsletterCta />
    </>
  );
}
