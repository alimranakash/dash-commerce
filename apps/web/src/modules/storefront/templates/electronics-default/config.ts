import type { StorefrontTemplateConfig } from "../types";
import { ElectronicsCategoryLayoutPlaceholder } from "./category-layout";
import { ElectronicsHomepageSections } from "./homepage-sections";
import { ElectronicsProductCard } from "./product-card";
import { ElectronicsProductPageLayoutPlaceholder } from "./product-page-layout";

export const electronicsDefaultTemplate: StorefrontTemplateConfig = {
  businessType: "Electronics",
  categoryPageVariant: "electronics-category-grid",
  components: {
    CategoryLayoutPlaceholder: ElectronicsCategoryLayoutPlaceholder,
    HomepageSections: ElectronicsHomepageSections,
    ProductCard: ElectronicsProductCard,
    ProductPageLayoutPlaceholder: ElectronicsProductPageLayoutPlaceholder
  },
  defaultColors: {
    background: "#f8fbff",
    primary: "#2563eb",
    secondary: "#dbeafe",
    surface: "#ffffff",
    text: "#111827"
  },
  description: "A crisp storefront foundation for electronics, accessories, and tech catalogs.",
  homepageSections: ["hero", "featured-categories", "featured-products", "trust-badges", "newsletter"],
  id: "electronics-default",
  name: "Electronics Default",
  previewImage: "/template-previews/electronics-default.png",
  productCardVariant: "electronics-spec-card",
  productPageVariant: "electronics-product-detail"
};
