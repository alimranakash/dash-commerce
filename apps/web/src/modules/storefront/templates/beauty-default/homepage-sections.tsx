import type { StorefrontTemplateHomepageProps } from "../types";
import {
  BeautyBrandStory,
  BeautyCategoryGrid,
  BeautyCollections,
  BeautyConcernGrid,
  BeautyHero,
  BeautyNewsletter,
  BeautyProductGrid,
  BeautyReviews,
  BeautySection,
  BeautyTipsGuide
} from "./components";

export function BeautyHomepageSections({
  homeData,
  store
}: StorefrontTemplateHomepageProps) {
  return (
    <div className="beauty-homepage">
      <BeautyHero
        storeName={store.name}
        storeSlug={store.slug}
        subtitle={store.themeSetting?.heroSubtitle ?? null}
        title={store.themeSetting?.heroTitle ?? null}
      />
      <BeautySection actionHref={`/s/${store.slug}/products`} eyebrow="Categories" id="beauty-categories" title="Shop by category">
        <BeautyCategoryGrid categories={homeData.categories} storeSlug={store.slug} />
      </BeautySection>
      <BeautySection actionHref={`/s/${store.slug}/products`} eyebrow="Best Sellers" id="beauty-best-sellers" title="Most loved beauty picks">
        <BeautyProductGrid
          currency={store.currency}
          products={homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </BeautySection>
      <BeautySection actionHref={`/s/${store.slug}/products`} eyebrow="Collections" id="beauty-collections" title="Featured collections">
        <BeautyCollections storeSlug={store.slug} />
      </BeautySection>
      <BeautySection actionHref={`/s/${store.slug}/products`} eyebrow="Concerns" id="beauty-concerns" title="Shop by concern">
        <BeautyConcernGrid storeSlug={store.slug} />
      </BeautySection>
      <BeautySection actionHref={`/s/${store.slug}/products`} eyebrow="New Arrivals" id="beauty-new-arrivals" title="Fresh formulas and new shades">
        <BeautyProductGrid
          currency={store.currency}
          products={homeData.newArrivals}
          storeSlug={store.slug}
        />
      </BeautySection>
      <BeautyTipsGuide />
      <BeautyReviews />
      <BeautyBrandStory storeName={store.name} storeSlug={store.slug} />
      <BeautyNewsletter />
    </div>
  );
}
