import { NotificationBarSlot } from "../../../notification-bar/components/notification-bar-slot";
import { storefrontBasePath } from "../../base-path";
import type { StorefrontTemplateHomepageProps } from "../types";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../customization";
import { resolveProductSectionProducts, type StorefrontProductPools } from "../../product-sections";
import { TabbedProductSection } from "../../components/tabbed-product-section";
import type { StorefrontProduct } from "../../storefront.types";
import {
  GeneralCategoryStrip,
  GeneralHero,
  GeneralProductSection,
  GeneralPromoBanner,
  GeneralRecommendedForYou,
  GeneralSectionWrapper
} from "./components";

export async function GeneralHomepageSections({
  homeData,
  primaryDomain,
  settings,
  store
}: StorefrontTemplateHomepageProps) {
  const basePath = await storefrontBasePath(store.slug);
  const productSections =
    settings?.advancedSettings.productSections ??
    DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections;
  const featuredSection = {
    ...productSections.featured,
    title:
      store.themeSetting?.featuredSectionTitle || productSections.featured.title || "The Daily Edit"
  };
  const bestSellerSection = productSections.bestSellers;
  const newArrivalsSection = productSections.newArrivals;
  const trendingSection = productSections.trending;
  const tabbedProductShowcase =
    settings?.advancedSettings.tabbedProductShowcase ??
    DEFAULT_STOREFRONT_ADVANCED_SETTINGS.tabbedProductShowcase;
  const allProducts = uniqueProducts([
    ...homeData.featuredProducts,
    ...homeData.bestSellers,
    ...homeData.newArrivals
  ]);
  const bestSellers =
    homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts;
  const onSaleProducts = allProducts.filter((product) => Boolean(product.compareAtPrice));
  // The promo banner borrows real catalogue art rather than shipping its own
  // image, so it stays truthful for any store rather than only a demo one.
  const promoImageUrl =
    homeData.categories.find((category) => Boolean(category.imageUrl))?.imageUrl ??
    allProducts.flatMap((product) => product.images)[0]?.url;
  const pools: StorefrontProductPools = {
    "best-sellers": homeData.bestSellers,
    featured: homeData.featuredProducts,
    "new-arrivals": homeData.newArrivals,
    trending: homeData.trending
  };

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
      {/* The two home anchors only a template can place: the storefront page
        owns the top and the footer edge, and this file is the only one that
        knows where its own hero ends. Both render nothing unless the seller
        picked that anchor. */}
      <NotificationBarSlot anchor="after_hero" store={store} surface="home" />
      <GeneralSectionWrapper
        actionHref={`${basePath}/products`}
        id="general-categories"
        title="Shop by Category"
      >
        <GeneralCategoryStrip categories={homeData.categories} storeSlug={store.slug} />
      </GeneralSectionWrapper>
      <NotificationBarSlot anchor="after_first_section" store={store} surface="home" />
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
        id="general-featured"
        products={resolveProductSectionProducts(featuredSection, pools)}
        section={featuredSection}
        storeSlug={store.slug}
      />
      <GeneralPromoBanner imageUrl={promoImageUrl} storeSlug={store.slug} />
      <GeneralProductSection
        currency={store.currency}
        id="general-best-sellers"
        products={resolveProductSectionProducts(bestSellerSection, {
          ...pools,
          "best-sellers": bestSellers
        })}
        section={bestSellerSection}
        storeSlug={store.slug}
      />
      <GeneralProductSection
        currency={store.currency}
        id="general-new-arrivals"
        products={resolveProductSectionProducts(newArrivalsSection, pools)}
        section={newArrivalsSection}
        storeSlug={store.slug}
      />
      <GeneralProductSection
        currency={store.currency}
        id="general-trending"
        products={resolveProductSectionProducts(trendingSection, pools)}
        section={trendingSection}
        storeSlug={store.slug}
      />
      <GeneralRecommendedForYou
        categories={homeData.categories}
        currency={store.currency}
        enableHoverImage={featuredSection.enableHoverImage}
        products={allProducts}
      />
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
