import type { DemoPack } from "../types";
import { beautyDemoCategories } from "./categories";
import { beautyDemoCollections } from "./collections";
import { beautyDemoHomepage } from "./homepage";
import { beautyDemoMedia } from "./media";
import { beautyDemoNavigation } from "./navigation";
import { beautyDemoPages } from "./pages";
import { beautyDemoProducts } from "./products";
import { beautyDemoSettings } from "./settings";

export const beautyDemoPack: DemoPack = {
  businessType: "Cosmetics & Beauty",
  compatibleTemplate: "beauty-default",
  content: {
    categories: beautyDemoCategories,
    collections: beautyDemoCollections,
    homepage: beautyDemoHomepage,
    media: beautyDemoMedia,
    navigation: beautyDemoNavigation,
    pages: beautyDemoPages,
    products: beautyDemoProducts,
    settings: beautyDemoSettings
  },
  description: "Starter demo architecture for cosmetics, skincare, and beauty brands.",
  id: "beauty-demo-v1",
  metadata: {
    demoProductCount: beautyDemoProducts.length,
    size: "mvp"
  },
  name: "Cosmetics & Beauty Demo Pack v1",
  version: "1.0.0"
};
