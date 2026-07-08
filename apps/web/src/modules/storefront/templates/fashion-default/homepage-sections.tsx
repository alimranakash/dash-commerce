import type { StorefrontTemplateHomepageProps } from "../types";
import {
  FashionCategoryCards,
  FashionCollectionCards,
  FashionCommunityGallery,
  FashionEditorialBanner,
  FashionEditorialCollectionGrid,
  FashionFeaturedLook,
  FashionHero,
  FashionNewsletter,
  FashionProductGrid,
  FashionSection
} from "./components";

export function FashionHomepageSections({
  homeData,
  settings,
  store
}: StorefrontTemplateHomepageProps) {
  return (
    <div className="fashion-homepage">
      <FashionHero
        storeName={store.name}
        storeSlug={store.slug}
        advancedSettings={settings?.advancedSettings}
        heroImageUrl={settings?.heroImageUrl ?? store.themeSetting?.heroImageUrl}
        subtitle={store.themeSetting?.heroSubtitle ?? null}
        title={store.themeSetting?.heroTitle ?? null}
      />
      <FashionEditorialCollectionGrid
        categories={homeData.categories}
        storeSlug={store.slug}
      />
      <FashionSection actionHref={`/s/${store.slug}/products`} eyebrow="New Collection" id="fashion-new-collection" title="The latest collection">
        <FashionProductGrid
          currency={store.currency}
          products={homeData.newArrivals}
          storeSlug={store.slug}
        />
      </FashionSection>
      <FashionSection actionHref={`/s/${store.slug}/products`} eyebrow="Collections" id="fashion-featured-collections" title="Featured collections">
        <FashionCollectionCards storeSlug={store.slug} />
      </FashionSection>
      <FashionSection actionHref={`/s/${store.slug}/products`} eyebrow="Categories" id="fashion-categories" title="Shop by category">
        <FashionCategoryCards categories={homeData.categories} storeSlug={store.slug} />
      </FashionSection>
      <FashionSection actionHref={`/s/${store.slug}/products`} eyebrow="Trending" id="fashion-trending" title="Trending products">
        <FashionProductGrid
          currency={store.currency}
          products={homeData.featuredProducts}
          storeSlug={store.slug}
        />
      </FashionSection>
      <FashionEditorialBanner storeSlug={store.slug} />
      <FashionFeaturedLook storeSlug={store.slug} />
      <FashionCommunityGallery />
      <FashionNewsletter />
    </div>
  );
}
