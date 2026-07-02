import type { StorefrontTemplateHomepageProps } from "../types";
import {
  GeneralCategoryStrip,
  GeneralCollections,
  GeneralHero,
  GeneralNewsletter,
  GeneralProductGrid,
  GeneralPromoBanner,
  GeneralRecentlyAddedFallback,
  GeneralSectionWrapper
} from "./components";

export function GeneralHomepageSections({
  homeData,
  primaryDomain,
  settings,
  store
}: StorefrontTemplateHomepageProps) {
  return (
    <div className="general-homepage">
      <GeneralHero
        advancedSettings={settings?.advancedSettings}
        heroImageUrl={settings?.heroImageUrl ?? store.themeSetting?.heroImageUrl}
        primaryDomain={primaryDomain}
        storeName={store.name}
        storeSlug={store.slug}
        subtitle={store.themeSetting?.heroSubtitle}
        title={store.themeSetting?.heroTitle}
      />
      <GeneralSectionWrapper actionHref={`/s/${store.slug}/products`} id="general-categories" title="Shop by Category">
        <GeneralCategoryStrip categories={homeData.categories} storeSlug={store.slug} />
      </GeneralSectionWrapper>
      <GeneralSectionWrapper actionHref={`/s/${store.slug}/products`} id="featured-products" title={store.themeSetting?.featuredSectionTitle || "Featured Products"}>
        <GeneralProductGrid
          currency={store.currency}
          products={homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </GeneralSectionWrapper>
      <GeneralSectionWrapper actionHref={`/s/${store.slug}/products`} id="general-collections" title="Explore Collections">
        <GeneralCollections storeSlug={store.slug} />
      </GeneralSectionWrapper>
      <GeneralPromoBanner storeSlug={store.slug} />
      <GeneralSectionWrapper actionHref={`/s/${store.slug}/products`} id="best-sellers" title="Best Sellers">
        <GeneralProductGrid
          currency={store.currency}
          products={homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts}
          storeSlug={store.slug}
          variant="compact"
        />
      </GeneralSectionWrapper>
      <GeneralSectionWrapper actionHref={`/s/${store.slug}/products`} id="new-arrivals" title="Recently Added">
        {homeData.newArrivals.length > 0 ? (
          <GeneralProductGrid
            currency={store.currency}
            products={homeData.newArrivals}
            storeSlug={store.slug}
            variant="compact"
          />
        ) : (
          <GeneralRecentlyAddedFallback currency={store.currency} storeSlug={store.slug} />
        )}
      </GeneralSectionWrapper>
      <GeneralNewsletter />
    </div>
  );
}
