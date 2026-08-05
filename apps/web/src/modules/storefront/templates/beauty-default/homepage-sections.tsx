import type { StorefrontTemplateHomepageProps } from "../types";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontProductSectionSettings
} from "../../customization";
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
    ...homepageProductSection(productSections.bestSellers),
    title: productSections.bestSellers.title || "Most loved beauty picks"
  };
  const newArrivalsSection = {
    ...homepageProductSection(productSections.newArrivals),
    title: productSections.newArrivals.title || "Fresh formulas and new shades"
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
        products={homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts}
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
        products={homeData.newArrivals}
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

// Mirrors the General Default homepage: every product row is a slider showing the
// same number of cards per view, so the arrows behave identically from row to row.
const HOMEPAGE_PRODUCTS_PER_VIEW = 5 as const;

function homepageProductSection(section: StorefrontProductSectionSettings): StorefrontProductSectionSettings {
  return {
    ...section,
    columns: HOMEPAGE_PRODUCTS_PER_VIEW,
    // A slider row must render more cards than fit in one viewport, otherwise
    // there is nothing to scroll and the prev/next arrows stay disabled.
    count: Math.max(section.count, HOMEPAGE_PRODUCTS_PER_VIEW * 2),
    mode: "slider"
  };
}
