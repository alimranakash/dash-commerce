import type { StorefrontTemplateHomepageProps } from "../types";
import { FashionNewArrivals } from "./fashion-new-arrivals";
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
      <FashionNewArrivals
        currency={store.currency}
        description="Discover the latest ready-to-wear dresses."
        products={homeData.newArrivals.map((product) => ({
          category: product.category
            ? {
                name: product.category.name,
                slug: product.category.slug
              }
            : null,
          compareAtPrice: product.compareAtPrice?.toString() ?? null,
          id: product.id,
          images: product.images.map((image) => ({
            alt: image.alt,
            url: image.url
          })),
          price: product.price.toString(),
          slug: product.slug,
          stockQuantity: product.stockQuantity,
          storeId: product.storeId,
          title: product.title
        }))}
        storeSlug={store.slug}
        title="New Arrivals"
      />
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
