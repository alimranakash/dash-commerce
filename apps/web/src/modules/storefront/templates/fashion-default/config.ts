import type { StorefrontTemplateConfig } from "../types";
import { FashionCategoryLayoutPlaceholder } from "./category-layout";
import { FashionHomepageSections } from "./homepage-sections";
import { FashionProductCard } from "./product-card";
import { FashionProductDetailExtras } from "./product-detail-extras";
import { FashionProductPageLayoutPlaceholder } from "./product-page-layout";

export const fashionDefaultTemplate: StorefrontTemplateConfig = {
  businessType: "Fashion",
  categoryPageVariant: "fashion-collection-grid",
  components: {
    CategoryLayoutPlaceholder: FashionCategoryLayoutPlaceholder,
    HomepageSections: FashionHomepageSections,
    ProductCard: FashionProductCard,
    ProductDetailExtras: FashionProductDetailExtras,
    ProductPageLayoutPlaceholder: FashionProductPageLayoutPlaceholder
  },
  defaultColors: {
    background: "#fffaf5",
    primary: "#7c2d12",
    secondary: "#fed7aa",
    surface: "#ffffff",
    text: "#221713"
  },
  description: "An elegant storefront foundation for fashion brands and curated collections.",
  homepageSections: [
    "hero",
    "new-arrivals",
    "collections",
    "featured-categories",
    "featured-products",
    "promotional-banner",
    "lookbook",
    "community-gallery",
    "newsletter"
  ],
  id: "fashion-default",
  name: "Fashion Default",
  previewImage: "/template-previews/fashion-default.png",
  productCardVariant: "fashion-editorial",
  productPageVariant: "fashion-product-detail"
};
