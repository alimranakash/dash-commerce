import type { StorefrontTemplateConfig } from "../types";
import { BeautyCategoryLayoutPlaceholder } from "./category-layout";
import { BeautyHomepageSections } from "./homepage-sections";
import { BeautyProductCard } from "./product-card";
import { BeautyProductPageLayoutPlaceholder } from "./product-page-layout";

export const beautyDefaultTemplate: StorefrontTemplateConfig = {
  businessType: "Cosmetics & Beauty",
  categoryPageVariant: "beauty-category-grid",
  components: {
    CategoryLayoutPlaceholder: BeautyCategoryLayoutPlaceholder,
    HomepageSections: BeautyHomepageSections,
    ProductCard: BeautyProductCard,
    ProductPageLayoutPlaceholder: BeautyProductPageLayoutPlaceholder
  },
  defaultColors: {
    background: "#fff7fb",
    primary: "#be185d",
    secondary: "#fce7f3",
    surface: "#ffffff",
    text: "#2d1721"
  },
  description: "A soft storefront foundation for cosmetics, skincare, and beauty brands.",
  homepageSections: ["hero", "featured-categories", "featured-products", "trust-badges", "newsletter"],
  id: "beauty-default",
  name: "Beauty Default",
  previewImage: "/template-previews/beauty-default.png",
  productCardVariant: "beauty-soft-card",
  productPageVariant: "beauty-product-detail"
};
