import type { DemoPack } from "../types";
import { fashionDemoAdvancedSettings } from "./advanced-settings";
import { fashionDemoBrands } from "./brands";
import { fashionDemoCategories } from "./categories";
import { fashionDemoCollections } from "./collections";
import { fashionDemoHomepage } from "./homepage";
import { fashionDemoMedia } from "./media";
import { fashionDemoNavigation } from "./navigation";
import { fashionDemoPages } from "./pages";
import { fashionDemoProducts } from "./products";
import { fashionDemoSettings } from "./settings";
import { fashionDemoTags } from "./tags";

export const fashionDemoPack: DemoPack = {
  businessType: "Fashion",
  compatibleTemplate: "fashion-default",
  content: {
    advancedSettings: fashionDemoAdvancedSettings,
    brands: fashionDemoBrands,
    categories: fashionDemoCategories,
    collections: fashionDemoCollections,
    homepage: fashionDemoHomepage,
    media: fashionDemoMedia,
    navigation: fashionDemoNavigation,
    pages: fashionDemoPages,
    products: fashionDemoProducts,
    settings: fashionDemoSettings,
    tags: fashionDemoTags
  },
  description:
    "A complete fashion catalogue: 24 products across 6 categories, with brands, tags and two images per product.",
  id: "fashion-demo-v1",
  metadata: {
    demoProductCount: fashionDemoProducts.length,
    size: "mvp"
  },
  name: "Fashion Demo Pack v1",
  version: "2.0.0"
};
