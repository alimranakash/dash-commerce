import type { StorefrontTemplateConfig } from "../types";
import { BEAUTY_PRODUCT_CARD_VARIANT } from "./beauty-listing-card";
import { BeautyCategoryLayoutPlaceholder } from "./category-layout";
import { BeautyHomepageSections } from "./homepage-sections";
import { BeautyProductCard } from "./product-card";
import { BeautyProductDetailExtras } from "./product-detail-extras";
import { BeautyProductPageLayoutPlaceholder } from "./product-page-layout";

export const beautyDefaultTemplate: StorefrontTemplateConfig = {
  businessType: "Cosmetics & Beauty",
  categoryPageVariant: "beauty-category-grid",
  components: {
    CategoryLayoutPlaceholder: BeautyCategoryLayoutPlaceholder,
    HomepageSections: BeautyHomepageSections,
    ProductCard: BeautyProductCard,
    ProductDetailExtras: BeautyProductDetailExtras,
    ProductPageLayoutPlaceholder: BeautyProductPageLayoutPlaceholder
  },
  defaultColors: {
    background: "#fff7fb",
    primary: "#87745e",
    secondary: "#fce7f3",
    surface: "#ffffff",
    text: "#2d1721"
  },
  description: "A soft storefront foundation for cosmetics, skincare, and beauty brands.",
  homepageSections: [
    "hero",
    "featured-categories",
    "best-sellers",
    "collections",
    "shop-by-concern",
    "new-arrivals",
    "beauty-tips",
    "customer-reviews",
    "brand-story",
    "newsletter"
  ],
  id: "beauty-default",
  name: "Beauty Default",
  previewImage: "/template-previews/beauty-default.png",
  productCardVariant: BEAUTY_PRODUCT_CARD_VARIANT,
  productPageVariant: "beauty-product-detail"
};
