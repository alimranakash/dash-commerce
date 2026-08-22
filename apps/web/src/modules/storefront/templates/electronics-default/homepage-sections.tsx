import { storefrontBasePath } from "../../base-path";
import type { StorefrontTemplateHomepageProps } from "../types";
import {
  ElectronicsBrandGrid,
  ElectronicsCategoryGrid,
  ElectronicsFlashDeals,
  ElectronicsHero,
  ElectronicsProductGrid,
  ElectronicsRecommendedForYou,
  ElectronicsSection,
  ElectronicsTechnologyBanner,
  ElectronicsWhyChooseUs
} from "./components";

export async function ElectronicsHomepageSections({
  homeData,
  settings,
  store
}: StorefrontTemplateHomepageProps) {
  const basePath = await storefrontBasePath(store.slug);
  const advanced = settings?.advancedSettings;
  const electronics = advanced?.electronics;
  const productSections = advanced?.productSections;
  const allProducts = uniqueProducts([
    ...homeData.featuredProducts,
    ...homeData.bestSellers,
    ...homeData.newArrivals
  ]);
  const featuredSection = productSections?.featured;
  const flashSection = productSections?.bestSellers;
  const newArrivalsSection = productSections?.newArrivals;

  return (
    <div className="electronics-homepage">
      <ElectronicsHero
        categories={homeData.categories}
        electronicsSettings={electronics}
        heroSettings={advanced?.hero}
        products={allProducts}
        storeSlug={store.slug}
        subtitle={store.themeSetting?.heroSubtitle ?? null}
        title={store.themeSetting?.heroTitle ?? null}
      />
      <ElectronicsSection actionHref={`${basePath}/products`} eyebrow="Categories" id="electronics-categories" title={electronics?.categorySectionTitle ?? "Top categories"}>
        <ElectronicsCategoryGrid
          categories={homeData.categories}
          products={allProducts}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <ElectronicsSection eyebrow="Brands" id="electronics-brands" title={electronics?.brandSectionTitle ?? "Featured brands"}>
        <ElectronicsBrandGrid
          products={allProducts}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <ElectronicsSection actionHref={`${basePath}${featuredSection?.ctaLink ?? "/products"}`} actionLabel={featuredSection?.ctaText} eyebrow="Featured" id="electronics-featured" title={featuredSection?.title || electronics?.featuredSectionTitle || "Featured products"}>
        <ElectronicsProductGrid
          count={featuredSection?.count}
          currency={store.currency}
          enableHoverImage={featuredSection?.enableHoverImage}
          products={homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <ElectronicsFlashDeals
        count={flashSection?.count}
        currency={store.currency}
        electronicsSettings={electronics}
        enableHoverImage={flashSection?.enableHoverImage}
        products={homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts}
        storeSlug={store.slug}
      />
      <ElectronicsSection actionHref={`${basePath}${newArrivalsSection?.ctaLink ?? "/products"}`} actionLabel={newArrivalsSection?.ctaText} eyebrow="New Arrivals" id="electronics-new-arrivals" title={newArrivalsSection?.title || electronics?.newArrivalsTitle || "Latest devices and accessories"}>
        <ElectronicsProductGrid
          count={newArrivalsSection?.count}
          currency={store.currency}
          enableHoverImage={newArrivalsSection?.enableHoverImage}
          products={homeData.newArrivals}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <ElectronicsTechnologyBanner
        electronicsSettings={electronics}
        products={allProducts}
        storeSlug={store.slug}
      />
      <ElectronicsRecommendedForYou
        categories={homeData.categories}
        currency={store.currency}
        electronicsSettings={electronics}
        enableHoverImage={featuredSection?.enableHoverImage}
        products={allProducts}
        storeSlug={store.slug}
      />
      <ElectronicsWhyChooseUs items={electronics?.trustItems} />
    </div>
  );
}

function uniqueProducts<T extends { id: string }>(products: T[]) {
  return Array.from(new Map(products.map((product) => [product.id, product])).values());
}
