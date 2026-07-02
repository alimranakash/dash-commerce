import type { StorefrontTemplateHomepageProps } from "../types";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../customization";
import {
  GeneralCategoryStrip,
  GeneralCollections,
  GeneralHero,
  GeneralNewsletter,
  GeneralProductSection,
  GeneralPromoBanner,
  GeneralSectionWrapper
} from "./components";

export function GeneralHomepageSections({
  homeData,
  primaryDomain,
  settings,
  store
}: StorefrontTemplateHomepageProps) {
  const productSections = settings?.advancedSettings.productSections ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections;
  const featuredSection = {
    ...productSections.featured,
    title: store.themeSetting?.featuredSectionTitle || productSections.featured.title || "The Daily Edit"
  };
  const bestSellerSection = productSections.bestSellers;
  const newArrivalsSection = productSections.newArrivals;
  const trendingSection = productSections.trending;

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
      <GeneralProductSection
        count="1 / 3"
        currency={store.currency}
        products={homeData.featuredProducts}
        section={featuredSection}
        storeSlug={store.slug}
      />
      <GeneralProductSection
        count="1 / 3"
        currency={store.currency}
        products={homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts}
        section={trendingSection}
        storeSlug={store.slug}
      />
      <GeneralSectionWrapper actionHref={`/s/${store.slug}/products`} id="general-collections" title="Explore Collections">
        <GeneralCollections storeSlug={store.slug} />
      </GeneralSectionWrapper>
      <GeneralPromoBanner storeSlug={store.slug} />
      <GeneralProductSection
        count="1 / 3"
        currency={store.currency}
        products={homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts}
        section={bestSellerSection}
        storeSlug={store.slug}
      />
      <GeneralProductSection
        count="1 / 3"
        currency={store.currency}
        products={homeData.newArrivals}
        section={newArrivalsSection}
        storeSlug={store.slug}
      />
      <GeneralNewsletter />
    </div>
  );
}
