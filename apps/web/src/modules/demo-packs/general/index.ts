import type { DemoPack } from "../types";
import { generalDemoCategories } from "./categories";
import { generalDemoCollections } from "./collections";
import { generalDemoHomepage } from "./homepage";
import { generalDemoMedia } from "./media";
import { generalDemoNavigation } from "./navigation";
import { generalDemoPages } from "./pages";
import { generalDemoProducts } from "./products";
import { generalDemoSettings } from "./settings";

export const generalDemoPack: DemoPack = {
  businessType: "General Store",
  compatibleTemplate: "general-default",
  content: {
    categories: generalDemoCategories,
    collections: generalDemoCollections,
    homepage: generalDemoHomepage,
    media: generalDemoMedia,
    navigation: generalDemoNavigation,
    pages: generalDemoPages,
    products: generalDemoProducts,
    settings: generalDemoSettings
  },
  description: "Starter demo architecture for a broad ecommerce store.",
  id: "general-demo-v1",
  metadata: {
    demoProductCount: generalDemoProducts.length,
    size: "mvp"
  },
  name: "General Demo Pack v1",
  version: "1.0.0"
};
