import { CategorySection } from "../../components/category-section";
import { HeroSection } from "../../components/hero-section";
import { NewsletterCta } from "../../components/newsletter-cta";
import { TrustBadges } from "../../components/trust-badges";
import type { StorefrontTemplateHomepageProps } from "../types";
import { FashionLookbook, FashionProductGrid, FashionPromoBanner, FashionSection } from "./components";

export function FashionHomepageSections({
  homeData,
  primaryDomain,
  store
}: StorefrontTemplateHomepageProps) {
  return (
    <>
      <HeroSection primaryDomain={primaryDomain} store={store} />
      <FashionSection eyebrow="New Collection" id="fashion-new-collection" title="The latest collection">
        <FashionProductGrid
          currency={store.currency}
          emptyText="New collection products will appear as soon as the seller publishes them."
          emptyTitle="New collection coming soon"
          products={homeData.newArrivals}
          storeSlug={store.slug}
        />
      </FashionSection>
      <CategorySection categories={homeData.categories} storeSlug={store.slug} />
      <FashionSection eyebrow="New Arrivals" id="fashion-new-arrivals" title="Fresh pieces just landed">
        <FashionProductGrid
          currency={store.currency}
          emptyText="Fresh arrivals will show here automatically."
          emptyTitle="No arrivals yet"
          products={homeData.newArrivals}
          storeSlug={store.slug}
        />
      </FashionSection>
      <FashionSection eyebrow="Trending" id="fashion-trending" title="Trending products">
        <FashionProductGrid
          currency={store.currency}
          emptyText="Trending products will appear as customers discover the catalog."
          emptyTitle="Trending products coming soon"
          products={homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </FashionSection>
      <FashionPromoBanner storeSlug={store.slug} />
      <FashionSection eyebrow="Best Sellers" id="fashion-best-sellers" title="Customer favorites">
        <FashionProductGrid
          currency={store.currency}
          emptyText="Best sellers will appear once orders are placed."
          emptyTitle="Best sellers coming soon"
          products={homeData.bestSellers}
          storeSlug={store.slug}
        />
      </FashionSection>
      <FashionLookbook storeSlug={store.slug} />
      <TrustBadges />
      <NewsletterCta />
    </>
  );
}
