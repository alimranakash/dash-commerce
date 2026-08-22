import { storefrontBasePath } from "../../base-path";
import type { StorefrontTemplateHomepageProps } from "../types";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../customization";
import {
  resolveProductSectionProducts,
  type StorefrontProductPools
} from "../../product-sections";
import { BeautyBeforeAfterSection } from "./beauty-before-after";
import { toBeautyComparisonProduct } from "./beauty-comparison-product";
import { BeautyCuratedSection } from "./beauty-curated";
import { BeautyHotPicksSection } from "./beauty-hot-picks";
import { BeautyMomentsSection } from "./beauty-moments";
import { BeautySpotlightSection } from "./beauty-spotlight";
import {
  BeautyCategoryGrid,
  BeautyHero,
  BeautyNewsletter,
  BeautyProductSection,
  BeautySection
} from "./components";

export async function BeautyHomepageSections({
  homeData,
  settings,
  store
}: StorefrontTemplateHomepageProps) {
  const basePath = await storefrontBasePath(store.slug);
  const productSections = settings?.advancedSettings.productSections ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections;
  const bestSellerSection = {
    ...productSections.bestSellers,
    title: productSections.bestSellers.title || "Most loved beauty picks"
  };
  const newArrivalsSection = {
    ...productSections.newArrivals,
    title: productSections.newArrivals.title || "Fresh formulas and new shades"
  };
  // The comparison card advertises one hero product; best sellers first so the
  // band promotes the same thing the rest of the page leads with.
  const comparisonProduct =
    homeData.bestSellers[0] ?? homeData.featuredProducts[0] ?? homeData.newArrivals[0] ?? null;
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
      <BeautySection actionHref={`${basePath}/products`} eyebrow="Categories" id="beauty-categories" title="Shop by category">
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
      <BeautySpotlightSection
        advancedSettings={settings?.advancedSettings}
        categories={homeData.categories}
        currency={store.currency}
        fallbackImageUrl={settings?.heroImageUrl ?? store.themeSetting?.heroImageUrl}
        productPools={[homeData.bestSellers, homeData.featuredProducts, homeData.newArrivals]}
        storeId={store.id}
        storeSlug={store.slug}
      />
      <BeautyProductSection
        currency={store.currency}
        id="beauty-new-arrivals"
        products={resolveProductSectionProducts(newArrivalsSection, pools)}
        section={newArrivalsSection}
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
      <BeautyHotPicksSection
        advancedSettings={settings?.advancedSettings}
        categories={homeData.categories}
        currency={store.currency}
        productPools={[homeData.bestSellers, homeData.featuredProducts, homeData.newArrivals, homeData.trending]}
        storeId={store.id}
        storeSlug={store.slug}
      />
      <BeautyBeforeAfterSection
        advancedSettings={settings?.advancedSettings}
        currency={store.currency}
        product={comparisonProduct ? toBeautyComparisonProduct(comparisonProduct) : null}
        storeSlug={store.slug}
      />
      <BeautyMomentsSection advancedSettings={settings?.advancedSettings} />
      <BeautyNewsletter />
    </div>
  );
}
