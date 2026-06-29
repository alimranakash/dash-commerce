import { CategorySection } from "../../components/category-section";
import { HeroSection } from "../../components/hero-section";
import { NewsletterCta } from "../../components/newsletter-cta";
import type { StorefrontTemplateHomepageProps } from "../types";
import {
  BeautyProductGrid,
  BeautyReviewsPlaceholder,
  BeautyRoutineBlocks,
  BeautySection,
  BeautyTipsPlaceholder
} from "./components";

export function BeautyHomepageSections({
  homeData,
  primaryDomain,
  store
}: StorefrontTemplateHomepageProps) {
  return (
    <>
      <HeroSection primaryDomain={primaryDomain} store={store} />
      <BeautySection eyebrow="Best Sellers" id="beauty-best-sellers" title="Most loved beauty picks">
        <BeautyProductGrid
          currency={store.currency}
          emptyText="Best sellers will appear once customers start placing orders."
          emptyTitle="Best sellers coming soon"
          products={homeData.bestSellers}
          storeSlug={store.slug}
        />
      </BeautySection>
      <CategorySection categories={homeData.categories} storeSlug={store.slug} />
      <BeautySection eyebrow="New Arrivals" id="beauty-new-arrivals" title="Fresh formulas and new shades">
        <BeautyProductGrid
          currency={store.currency}
          emptyText="New beauty products will appear here automatically."
          emptyTitle="No new arrivals yet"
          products={homeData.newArrivals}
          storeSlug={store.slug}
        />
      </BeautySection>
      <BeautyRoutineBlocks storeSlug={store.slug} />
      <BeautySection eyebrow="Featured Beauty" id="beauty-featured" title="Featured beauty products">
        <BeautyProductGrid
          currency={store.currency}
          emptyText="Featured beauty products will appear when products are published."
          emptyTitle="Featured products coming soon"
          products={homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </BeautySection>
      <BeautyReviewsPlaceholder />
      <BeautyTipsPlaceholder />
      <NewsletterCta />
    </>
  );
}
