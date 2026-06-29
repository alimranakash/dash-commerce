import type { StorefrontTemplateConfig } from "../types";
import { GeneralCategoryLayoutPlaceholder } from "./category-layout";
import { GeneralHomepageSections } from "./homepage-sections";
import { GeneralProductCard } from "./product-card";
import { GeneralProductPageLayoutPlaceholder } from "./product-page-layout";

export const generalDefaultTemplate: StorefrontTemplateConfig = {
  businessType: "General Store",
  categoryPageVariant: "general-category-grid",
  components: {
    CategoryLayoutPlaceholder: GeneralCategoryLayoutPlaceholder,
    HomepageSections: GeneralHomepageSections,
    ProductCard: GeneralProductCard,
    ProductPageLayoutPlaceholder: GeneralProductPageLayoutPlaceholder
  },
  defaultColors: {
    background: "#fbfaf7",
    primary: "#135d66",
    secondary: "#f5f1e8",
    surface: "#ffffff",
    text: "#171717"
  },
  description: "A minimal neutral storefront for general catalogs and mixed products.",
  homepageSections: [
    "hero",
    "featured-categories",
    "featured-products",
    "new-arrivals",
    "promotional-banner",
    "best-sellers",
    "trust-badges",
    "newsletter",
    "footer-cta"
  ],
  id: "general-default",
  name: "General Default",
  previewImage: "/template-previews/general-default.png",
  productCardVariant: "general-minimal",
  productPageVariant: "general-product-detail"
};
