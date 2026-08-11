import type { DemoPack } from "../types";
import { beautyDemoAdvancedSettings } from "./advanced-settings";
import { beautyDemoBrands } from "./brands";
import { beautyDemoCategories } from "./categories";
import { beautyDemoCollections } from "./collections";
import { beautyDemoHomepage } from "./homepage";
import { beautyDemoMedia } from "./media";
import { beautyDemoNavigation } from "./navigation";
import { beautyDemoPages } from "./pages";
import { beautyDemoProducts } from "./products";
import { beautyDemoSettings } from "./settings";
import { beautyDemoTags } from "./tags";

export const beautyDemoPack: DemoPack = {
  businessType: "Cosmetics & Beauty",
  compatibleTemplate: "beauty-default",
  content: {
    advancedSettings: beautyDemoAdvancedSettings,
    brands: beautyDemoBrands,
    categories: beautyDemoCategories,
    collections: beautyDemoCollections,
    homepage: beautyDemoHomepage,
    media: beautyDemoMedia,
    navigation: beautyDemoNavigation,
    pages: beautyDemoPages,
    products: beautyDemoProducts,
    settings: beautyDemoSettings,
    tags: beautyDemoTags
  },
  description:
    "A complete cosmetics catalogue: 24 products across 6 categories, with brands, tags and two images per product.",
  id: "beauty-demo-v1",
  metadata: {
    demoProductCount: beautyDemoProducts.length,
    size: "mvp"
  },
  name: "Cosmetics & Beauty Demo Pack v1",
  version: "2.0.0"
};
