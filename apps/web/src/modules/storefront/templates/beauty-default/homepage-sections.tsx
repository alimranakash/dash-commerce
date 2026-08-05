import type { StorefrontTemplateHomepageProps } from "../types";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../customization";
import {
  resolveProductSectionProducts,
  type StorefrontProductPools
} from "../../product-sections";
import {
  BeautyBrandStory,
  BeautyCategoryGrid,
  BeautyCollections,
  BeautyConcernGrid,
  BeautyHero,
  BeautyNewsletter,
  BeautyProductSection,
  BeautyReviews,
  BeautySection,
  BeautyTipsGuide
} from "./components";

export function BeautyHomepageSections({
  homeData,
  settings,
  store
}: StorefrontTemplateHomepageProps) {
  const productSections = settings?.advancedSettings.productSections ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections;
  const bestSellerSection = {
    ...productSections.bestSellers,
    title: productSections.bestSellers.title || "Most loved beauty picks"
  };
  const newArrivalsSection = {
    ...productSections.newArrivals,
    title: productSections.newArrivals.title || "Fresh formulas and new shades"
  };
  const pools: StorefrontProductPools = {
    "best-sellers": homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts,
    featured: homeData.featuredProducts,
    "new-arrivals": homeData.newArrivals,
    trending: homeData.trending
  };

  return (
    <div className="beauty-homepage">
      <BeautyHero
        advancedSettings={settings?.advancedSettings}
        heroImageUrl={settings?.heroImageUrl ?? store.themeSetting?.heroImageUrl}
        storeName={store.name}
        storeSlug={store.slug}
        title={store.themeSetting?.heroTitle ?? null}
      />
      <BeautySection actionHref={`/s/${store.slug}/products`} eyebrow="Categories" id="beauty-categories" title="Shop by category">
        <BeautyCategoryGrid categories={homeData.categories} storeSlug={store.slug} />
      </BeautySection>
      <BeautyProductSection
        currency={store.currency}
        id="beauty-best-sellers"
        products={resolveProductSectionProducts(bestSellerSection, pools)}
        section={bestSellerSection}
        storeSlug={store.slug}
      />
      <BeautySection actionHref={`/s/${store.slug}/products`} eyebrow="Collections" id="beauty-collections" title="Featured collections">
        <BeautyCollections storeSlug={store.slug} />
      </BeautySection>
      <BeautySection actionHref={`/s/${store.slug}/products`} eyebrow="Concerns" id="beauty-concerns" title="Shop by concern">
        <BeautyConcernGrid storeSlug={store.slug} />
      </BeautySection>
      <BeautyProductSection
        currency={store.currency}
        id="beauty-new-arrivals"
        products={resolveProductSectionProducts(newArrivalsSection, pools)}
        section={newArrivalsSection}
        storeSlug={store.slug}
      />
      <BeautyTipsGuide />
      <BeautyReviews />
      <BeautyBrandStory storeName={store.name} storeSlug={store.slug} />
      <BeautyNewsletter />
    </div>
  );
}
