import type { StorefrontTemplateHomepageProps } from "../types";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontProductSectionSettings,
  type StorefrontTabbedProductShowcaseSettings
} from "../../customization";
import { TabbedProductSection } from "../../components/tabbed-product-section";
import type { StorefrontProduct } from "../../storefront.types";
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
    ...homepageProductSection(productSections.featured),
    title: store.themeSetting?.featuredSectionTitle || productSections.featured.title || "The Daily Edit"
  };
  const bestSellerSection = homepageProductSection(productSections.bestSellers);
  const newArrivalsSection = homepageProductSection(productSections.newArrivals);
  const trendingSection = homepageProductSection(productSections.trending);
  const tabbedProductShowcase = homepageTabbedSection(settings?.advancedSettings.tabbedProductShowcase ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.tabbedProductShowcase);
  const allProducts = uniqueProducts([
    ...homeData.featuredProducts,
    ...homeData.bestSellers,
    ...homeData.newArrivals
  ]);
  const bestSellers = homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts;
  const onSaleProducts = allProducts.filter((product) => Boolean(product.compareAtPrice));

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
      <TabbedProductSection
        currency={store.currency}
        productsBySource={{
          all: allProducts,
          "best-sellers": bestSellers,
          category: allProducts,
          collection: allProducts,
          featured: homeData.featuredProducts,
          manual: allProducts,
          "new-arrivals": homeData.newArrivals,
          "on-sale": onSaleProducts.length > 0 ? onSaleProducts : allProducts
        }}
        section={tabbedProductShowcase}
        storeSlug={store.slug}
      />
      <GeneralProductSection
        currency={store.currency}
        products={homeData.featuredProducts}
        section={featuredSection}
        storeSlug={store.slug}
      />
      <GeneralProductSection
        currency={store.currency}
        products={bestSellers}
        section={trendingSection}
        storeSlug={store.slug}
      />
      <GeneralSectionWrapper actionHref={`/s/${store.slug}/products`} id="general-collections" title="Explore Collections">
        <GeneralCollections storeSlug={store.slug} />
      </GeneralSectionWrapper>
      <GeneralPromoBanner storeSlug={store.slug} />
      <GeneralProductSection
        currency={store.currency}
        products={bestSellers}
        section={bestSellerSection}
        storeSlug={store.slug}
      />
      <GeneralProductSection
        currency={store.currency}
        products={homeData.newArrivals}
        section={newArrivalsSection}
        storeSlug={store.slug}
      />
      <GeneralNewsletter />
    </div>
  );
}

function uniqueProducts(products: StorefrontProduct[]) {
  const seen = new Set<string>();

  return products.filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }

    seen.add(product.id);
    return true;
  });
}

function homepageProductSection(section: StorefrontProductSectionSettings): StorefrontProductSectionSettings {
  const columns = 5 as const;

  return {
    ...section,
    columns,
    // A slider row must render more cards than fit in one viewport, otherwise
    // there is nothing to scroll and the prev/next arrows stay disabled.
    count: Math.max(section.count, section.mode === "slider" ? columns * 2 : columns)
  };
}

function homepageTabbedSection(section: StorefrontTabbedProductShowcaseSettings): StorefrontTabbedProductShowcaseSettings {
  return {
    ...section,
    productsPerTab: Math.max(section.productsPerTab, 5),
    productsPerView: 5 as const
  };
}
