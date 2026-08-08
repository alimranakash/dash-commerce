import type { StorefrontTemplateHomepageProps } from "../types";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../customization";
import {
  resolveProductSectionProducts,
  type StorefrontProductPools
} from "../../product-sections";
import { BeautyCuratedSection } from "./beauty-curated";
import {
  BeautyCategoryGrid,
  BeautyConcernGrid,
  BeautyHero,
  BeautyNewsletter,
  BeautyProductSection,
  BeautySection
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
        storeId={store.id}
        storeSlug={store.slug}
      />
      <BeautyCuratedSection
        advancedSettings={settings?.advancedSettings}
        categories={homeData.categories}
        currency={store.currency}
        fallbackImageUrl={settings?.heroImageUrl ?? store.themeSetting?.heroImageUrl}
        products={homeData.featuredProducts}
        storeId={store.id}
        storeSlug={store.slug}
      />
      <BeautySection actionHref={`/s/${store.slug}/products`} eyebrow="Concerns" id="beauty-concerns" title="Shop by concern">
        <BeautyConcernGrid storeSlug={store.slug} />
      </BeautySection>
      <BeautyProductSection
        currency={store.currency}
        id="beauty-new-arrivals"
        products={resolveProductSectionProducts(newArrivalsSection, pools)}
        section={newArrivalsSection}
        storeId={store.id}
        storeSlug={store.slug}
      />
      <BeautyNewsletter />
    </div>
  );
}
