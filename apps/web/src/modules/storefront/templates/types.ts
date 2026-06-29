import type { ComponentType } from "react";
import type { getStorefrontHomeData } from "../resolver";
import type { StorefrontProduct, StorefrontProductDetails, StorefrontStore } from "../storefront.types";

export type StorefrontTemplateBusinessType =
  | "Cosmetics & Beauty"
  | "Electronics"
  | "Fashion"
  | "General Store";

export type StorefrontTemplateSection =
  | "hero"
  | "featured-categories"
  | "featured-products"
  | "new-arrivals"
  | "best-sellers"
  | "promotional-banner"
  | "trust-badges"
  | "newsletter"
  | "footer-cta";

export type StorefrontTemplateColors = {
  background: string;
  primary: string;
  secondary: string;
  surface: string;
  text: string;
};

export type StorefrontTemplateHomepageProps = {
  homeData: Awaited<ReturnType<typeof getStorefrontHomeData>>;
  primaryDomain: string | undefined;
  store: StorefrontStore;
};

export type StorefrontTemplateProductCardProps = {
  currency: string;
  product: StorefrontProduct;
  storeSlug: string;
};

export type StorefrontTemplateProductDetailExtrasProps = {
  product: StorefrontProductDetails;
  store: StorefrontStore;
};

export type StorefrontTemplatePlaceholderProps = {
  store: StorefrontStore;
};

export type StorefrontTemplateConfig = {
  businessType: StorefrontTemplateBusinessType;
  categoryPageVariant: string;
  components: {
    CategoryLayoutPlaceholder: ComponentType<StorefrontTemplatePlaceholderProps>;
    HomepageSections: ComponentType<StorefrontTemplateHomepageProps>;
    ProductCard: ComponentType<StorefrontTemplateProductCardProps>;
    ProductDetailExtras?: ComponentType<StorefrontTemplateProductDetailExtrasProps>;
    ProductPageLayoutPlaceholder: ComponentType<StorefrontTemplatePlaceholderProps>;
  };
  defaultColors: StorefrontTemplateColors;
  description: string;
  homepageSections: StorefrontTemplateSection[];
  id: string;
  name: string;
  previewImage: string;
  productCardVariant: string;
  productPageVariant: string;
};
