import type { DemoPack } from "../types";
import { generalDemoAdvancedSettings } from "./advanced-settings";
import { generalDemoBrands } from "./brands";
import { generalDemoCategories } from "./categories";
import { generalDemoCollections } from "./collections";
import { generalDemoHomepage } from "./homepage";
import { generalDemoMedia } from "./media";
import { generalDemoNavigation } from "./navigation";
import { generalDemoPages } from "./pages";
import { generalDemoProducts } from "./products";
import { generalDemoSettings } from "./settings";
import { generalDemoTags } from "./tags";

export const generalDemoPack: DemoPack = {
  businessType: "General Store",
  compatibleTemplate: "general-default",
  content: {
    advancedSettings: generalDemoAdvancedSettings,
    brands: generalDemoBrands,
    categories: generalDemoCategories,
    collections: generalDemoCollections,
    homepage: generalDemoHomepage,
    media: generalDemoMedia,
    navigation: generalDemoNavigation,
    pages: generalDemoPages,
    products: generalDemoProducts,
    settings: generalDemoSettings,
    tags: generalDemoTags
  },
  description:
    "A complete general-store catalogue: 24 products across 6 categories, with brands, tags and two images per product.",
  id: "general-demo-v1",
  metadata: {
    demoProductCount: generalDemoProducts.length,
    size: "mvp"
  },
  name: "General Demo Pack v1",
  version: "2.0.0"
};
