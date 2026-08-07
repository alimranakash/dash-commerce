import type { DemoPack } from "../types";
import { electronicsDemoAdvancedSettings } from "./advanced-settings";
import { electronicsDemoBrands } from "./brands";
import { electronicsDemoCategories } from "./categories";
import { electronicsDemoCollections } from "./collections";
import { electronicsDemoHomepage } from "./homepage";
import { electronicsDemoMedia } from "./media";
import { electronicsDemoNavigation } from "./navigation";
import { electronicsDemoPages } from "./pages";
import { electronicsDemoProducts } from "./products";
import { electronicsDemoSettings } from "./settings";
import { electronicsDemoTags } from "./tags";

export const electronicsDemoPack: DemoPack = {
  businessType: "Electronics",
  compatibleTemplate: "electronics-default",
  content: {
    advancedSettings: electronicsDemoAdvancedSettings,
    brands: electronicsDemoBrands,
    categories: electronicsDemoCategories,
    collections: electronicsDemoCollections,
    homepage: electronicsDemoHomepage,
    media: electronicsDemoMedia,
    navigation: electronicsDemoNavigation,
    pages: electronicsDemoPages,
    products: electronicsDemoProducts,
    settings: electronicsDemoSettings,
    tags: electronicsDemoTags
  },
  description:
    "A complete electronics catalogue: 24 products across 6 categories, with brands, tags and two images per product.",
  id: "electronics-demo-v1",
  metadata: {
    demoProductCount: electronicsDemoProducts.length,
    size: "mvp"
  },
  name: "Electronics Demo Pack v1",
  version: "2.0.0"
};
