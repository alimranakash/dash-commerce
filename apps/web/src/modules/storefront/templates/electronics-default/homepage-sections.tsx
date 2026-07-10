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

export function ElectronicsHomepageSections({
  homeData,
  settings,
  store
}: StorefrontTemplateHomepageProps) {
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
      <ElectronicsSection actionHref={`/s/${store.slug}/products`} eyebrow="Categories" id="electronics-categories" title={electronics?.categorySectionTitle ?? "Top categories"}>
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
      <ElectronicsSection actionHref={`/s/${store.slug}${featuredSection?.ctaLink ?? "/products"}`} actionLabel={featuredSection?.ctaText} eyebrow="Featured" id="electronics-featured" title={featuredSection?.title || electronics?.featuredSectionTitle || "Featured products"}>
        <ElectronicsProductGrid
          count={featuredSection?.count}
          currency={store.currency}
          products={homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <ElectronicsFlashDeals
        count={flashSection?.count}
        currency={store.currency}
        electronicsSettings={electronics}
        products={homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts}
        storeSlug={store.slug}
      />
      <ElectronicsSection actionHref={`/s/${store.slug}${newArrivalsSection?.ctaLink ?? "/products"}`} actionLabel={newArrivalsSection?.ctaText} eyebrow="New Arrivals" id="electronics-new-arrivals" title={newArrivalsSection?.title || electronics?.newArrivalsTitle || "Latest devices and accessories"}>
        <ElectronicsProductGrid
          count={newArrivalsSection?.count}
          currency={store.currency}
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
