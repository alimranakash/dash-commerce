import type { StorefrontTemplateHomepageProps } from "../types";
import {
  ElectronicsBrandGrid,
  ElectronicsCategoryGrid,
  ElectronicsFlashDeals,
  ElectronicsHero,
  ElectronicsNewsletter,
  ElectronicsProductGrid,
  ElectronicsSection,
  ElectronicsTechnologyBanner,
  ElectronicsWhyChooseUs
} from "./components";

export function ElectronicsHomepageSections({
  homeData,
  store
}: StorefrontTemplateHomepageProps) {
  return (
    <div className="electronics-homepage">
      <ElectronicsHero
        storeName={store.name}
        storeSlug={store.slug}
        subtitle={store.themeSetting?.heroSubtitle ?? null}
        title={store.themeSetting?.heroTitle ?? null}
      />
      <ElectronicsSection actionHref={`/s/${store.slug}/products`} eyebrow="Categories" id="electronics-categories" title="Top categories">
        <ElectronicsCategoryGrid categories={homeData.categories} storeSlug={store.slug} />
      </ElectronicsSection>
      <ElectronicsSection eyebrow="Brands" id="electronics-brands" title="Featured brands">
        <ElectronicsBrandGrid />
      </ElectronicsSection>
      <ElectronicsSection actionHref={`/s/${store.slug}/products`} eyebrow="Featured" id="electronics-featured" title="Featured products">
        <ElectronicsProductGrid
          currency={store.currency}
          products={homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <ElectronicsFlashDeals
        currency={store.currency}
        products={homeData.bestSellers.length > 0 ? homeData.bestSellers : homeData.featuredProducts}
        storeSlug={store.slug}
      />
      <ElectronicsSection actionHref={`/s/${store.slug}/products`} eyebrow="New Arrivals" id="electronics-new-arrivals" title="Latest devices and accessories">
        <ElectronicsProductGrid
          currency={store.currency}
          products={homeData.newArrivals}
          storeSlug={store.slug}
        />
      </ElectronicsSection>
      <ElectronicsTechnologyBanner storeSlug={store.slug} />
      <ElectronicsWhyChooseUs />
      <ElectronicsNewsletter />
    </div>
  );
}
