import { storefrontBasePath } from "../../base-path";
import type { StorefrontTemplateHomepageProps } from "../types";
import { FashionBeforeAfter } from "./fashion-before-after";
import { FashionEditorialSplitBanner } from "./fashion-editorial-split-banner";
import { FashionNewArrivals } from "./fashion-new-arrivals";
import { toFashionProductCardData } from "./fashion-product-card-data";
import {
  FashionCategoryCards,
  FashionCommunityGallery,
  FashionEditorialBanner,
  FashionEditorialCollectionGrid,
  FashionFeaturedLook,
  FashionHero,
  FashionNewsletter,
  FashionProductGrid,
  FashionSection
} from "./components";

export async function FashionHomepageSections({
  homeData,
  settings,
  store
}: StorefrontTemplateHomepageProps) {
  const basePath = await storefrontBasePath(store.slug);
  const editorialImages = homeData.featuredProducts
    .flatMap((product) => product.images)
    .map((image) => image.url);
  const heroSlides = settings?.advancedSettings.hero.slides.filter(
    (slide) => slide.mediaType === "image"
  ) ?? [];
  const fashion = settings?.advancedSettings.fashion;
  const productSections = settings?.advancedSettings.productSections;
  const comparisonProduct = homeData.featuredProducts[0] ?? null;
  const comparisonImages = homeData.featuredProducts
    .flatMap((product) => product.images)
    .map((image) => image.url);
  const sectionMedia = [
    ...homeData.categories
      .filter((category) => Boolean(category.imageUrl))
      .map((category) => ({ alt: category.name, url: category.imageUrl })),
    ...homeData.featuredProducts.flatMap((product) =>
      product.images.map((image) => ({
        alt: image.alt ?? product.title,
        url: image.url
      }))
    ),
    ...homeData.newArrivals.flatMap((product) =>
      product.images.map((image) => ({
        alt: image.alt ?? product.title,
        url: image.url
      }))
    )
  ];

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
        ctas={fashion?.collectionCtas}
        storeSlug={store.slug}
      />
      <FashionNewArrivals
        currency={store.currency}
        description={fashion?.newArrivalsDescription ?? productSections?.newArrivals.subtitle ?? "Discover the latest ready-to-wear dresses."}
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
          isNew: true,
          price: product.price.toString(),
          slug: product.slug,
          stockQuantity: product.stockQuantity,
          storeId: product.storeId,
          title: product.title
        }))}
        storeSlug={store.slug}
        title={fashion?.newArrivalsTitle ?? productSections?.newArrivals.title ?? "New Arrivals"}
      />
      <FashionEditorialSplitBanner
        ctaLink={resolveStorefrontHref(basePath, fashion?.editorialSplitCtaLink ?? "/products")}
        ctaText={fashion?.editorialSplitCtaText ?? "Explore"}
        heading={fashion?.editorialSplitHeading ?? "Timeless classics"}
        height={fashion?.editorialSplitHeight ?? settings?.advancedSettings.hero.customHeight ?? 720}
        leftImageUrl={fashion?.editorialSplitLeftImageUrl || heroSlides[1]?.url || editorialImages[0] || settings?.heroImageUrl}
        overlayOpacity={fashion?.editorialSplitOverlayOpacity ?? settings?.advancedSettings.hero.overlayOpacity}
        rightImageUrl={fashion?.editorialSplitRightImageUrl || heroSlides[2]?.url || editorialImages[1] || editorialImages[0]}
        textPosition="center"
      />
      <FashionSection actionHref={`${basePath}/products`} eyebrow="Categories" id="fashion-categories" title="Shop by category">
        <FashionCategoryCards categories={homeData.categories} storeSlug={store.slug} />
      </FashionSection>
      <FashionSection actionHref={resolveStorefrontHref(basePath, productSections?.trending.ctaLink ?? "/products")} actionLabel={productSections?.trending.ctaText} eyebrow="Trending" id="fashion-trending" title={productSections?.trending.title ?? "Trending products"}>
        <FashionProductGrid
          currency={store.currency}
          products={homeData.featuredProducts.slice(0, productSections?.trending.count ?? 4)}
          storeSlug={store.slug}
        />
      </FashionSection>
      <FashionBeforeAfter
        afterImageUrl={fashion?.beforeAfterAfterImageUrl || comparisonImages[1] || heroSlides[1]?.url || comparisonImages[0]}
        afterLabel={fashion?.beforeAfterAfterLabel}
        beforeImageUrl={fashion?.beforeAfterBeforeImageUrl || comparisonImages[0] || heroSlides[0]?.url || settings?.heroImageUrl}
        beforeLabel={fashion?.beforeAfterBeforeLabel}
        currency={store.currency}
        initialPosition={fashion?.beforeAfterInitialPosition ?? 50}
        product={comparisonProduct ? toFashionProductCardData(comparisonProduct) : null}
        storeSlug={store.slug}
      />
      <FashionEditorialBanner
        ctaLabel={fashion?.editorialBannerCtaText ?? settings?.advancedSettings.productSections.featured.ctaText}
        ctaLink={fashion?.editorialBannerCtaLink}
        imageUrl={fashion?.editorialBannerImageUrl || sectionMedia[0]?.url || settings?.heroImageUrl}
        storeSlug={store.slug}
        subtitle={fashion?.editorialBannerSubtitle ?? settings?.advancedSettings.productSections.featured.subtitle}
        title={fashion?.editorialBannerTitle ?? settings?.advancedSettings.productSections.featured.title}
      />
      <FashionFeaturedLook
        ctaLink={fashion?.featuredLookCtaLink}
        ctaText={fashion?.featuredLookCtaText}
        description={fashion?.featuredLookDescription}
        imageUrl={fashion?.featuredLookImageUrl || sectionMedia[1]?.url || sectionMedia[0]?.url}
        products={homeData.featuredProducts}
        storeSlug={store.slug}
        title={fashion?.featuredLookTitle}
      />
      <FashionCommunityGallery
        description={fashion?.communityDescription}
        images={[
          ...(fashion?.communityImages ?? []).map((url, index) => ({ alt: `Community style ${index + 1}`, url })),
          ...sectionMedia.slice(2, 8)
        ]}
        title={fashion?.communityTitle}
      />
      <FashionNewsletter
        buttonText={fashion?.newsletterButtonText}
        description={fashion?.newsletterDescription}
        imageUrl={fashion?.newsletterImageUrl || sectionMedia.at(-1)?.url || settings?.heroImageUrl}
        storeName={store.name}
        title={fashion?.newsletterTitle}
      />
    </div>
  );
}

function resolveStorefrontHref(basePath: string, href: string) {
  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
    return href;
  }

  if (href === "/") {
    return basePath || "/";
  }

  return `${basePath}${href.startsWith("/") ? href : `/${href}`}`;
}
