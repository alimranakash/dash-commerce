import type { StorefrontAdvancedSettings } from "../storefront/customization";

export type DemoPackBusinessType = "Cosmetics & Beauty" | "Electronics" | "Fashion" | "General Store";

/**
 * Packs author storefront settings as a partial tree; `normalizeAdvancedSettings`
 * fills every missing field from the shared defaults when the pack is seeded.
 * Arrays stay whole - a pack that overrides `hero.slides` replaces the list.
 */
export type DemoPackAdvancedSettings = DeepPartial<StorefrontAdvancedSettings>;

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends ReadonlyArray<unknown>
    ? T[K]
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K];
};

export type DemoPackCategory = {
  description?: string;
  imageAlt?: string;
  imageUrl?: string;
  name: string;
  slug: string;
};

export type DemoPackBrand = {
  imageAlt?: string;
  imageUrl?: string;
  name: string;
  slug: string;
};

export type DemoPackTag = {
  name: string;
  slug: string;
};

export type DemoPackProductImage = {
  alt: string;
  url: string;
};

export type DemoPackProduct = {
  /** Slug of a brand in the same pack, seeded as a BRAND taxonomy item. */
  brandSlug?: string | undefined;
  categorySlug: string;
  compareAtPrice?: string | undefined;
  description: string;
  imageAlt: string;
  imageUrl: string;
  /**
   * Full gallery, in display order. Packs that omit it fall back to the single
   * `imageUrl`/`imageAlt` pair; two or more entries enable the card hover swap.
   */
  images?: DemoPackProductImage[] | undefined;
  price: string;
  shortDescription: string;
  sku: string;
  slug: string;
  stockQuantity: number;
  /** Slugs of tags in the same pack, seeded as TAG taxonomy items. */
  tagSlugs?: string[] | undefined;
  title: string;
};

export type DemoPackHomepage = {
  ctaText?: string;
  beautyTipsTitle?: string;
  bestSellersTitle?: string;
  editorialBannerText?: string;
  featuredBrandsTitle?: string;
  featuredGadgetsTitle?: string;
  featuredSectionTitle?: string;
  flashDealsTitle?: string;
  heroSubtitle?: string;
  heroTitle?: string;
  heroImageUrl?: string;
  bannerImageUrl?: string;
  newCollectionTitle?: string;
  newsletterText?: string;
  promoBannerText?: string;
  shopByConcernTitle?: string;
  trendingProductsTitle?: string;
};

export type DemoPackNavigationItem = {
  href: string;
  label: string;
};

export type DemoPackSettings = {
  announcementText?: string;
  primaryColor?: string;
  secondaryColor?: string;
  storeTagline?: string;
};

export type DemoPackContent = {
  /** Storefront section copy owned by the pack, written to ThemeSetting.advancedSettings. */
  advancedSettings?: DemoPackAdvancedSettings | undefined;
  brands?: DemoPackBrand[] | undefined;
  categories: DemoPackCategory[];
  collections: unknown[];
  homepage: DemoPackHomepage;
  media: unknown[];
  navigation: DemoPackNavigationItem[];
  pages: unknown[];
  products: DemoPackProduct[];
  settings: DemoPackSettings;
  tags?: DemoPackTag[] | undefined;
};

export type DemoPack = {
  businessType: DemoPackBusinessType;
  compatibleTemplate: string;
  content: DemoPackContent;
  description: string;
  id: string;
  metadata: {
    demoProductCount: number;
    size: "mvp";
  };
  name: string;
  version: string;
};

export type DemoPackSeedContext = {
  demoPackId: string;
  organizationId: string;
  storeId: string;
};
