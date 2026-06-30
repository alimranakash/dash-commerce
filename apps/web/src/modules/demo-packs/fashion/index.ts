import type { DemoPack } from "../types";
import { fashionDemoCategories } from "./categories";
import { fashionDemoCollections } from "./collections";
import { fashionDemoHomepage } from "./homepage";
import { fashionDemoMedia } from "./media";
import { fashionDemoNavigation } from "./navigation";
import { fashionDemoPages } from "./pages";
import { fashionDemoProducts } from "./products";
import { fashionDemoSettings } from "./settings";

export const fashionDemoPack: DemoPack = {
  businessType: "Fashion",
  compatibleTemplate: "fashion-default",
  content: {
    categories: fashionDemoCategories,
    collections: fashionDemoCollections,
    homepage: fashionDemoHomepage,
    media: fashionDemoMedia,
    navigation: fashionDemoNavigation,
    pages: fashionDemoPages,
    products: fashionDemoProducts,
    settings: fashionDemoSettings
  },
  description: "Starter demo architecture for apparel, accessories, and fashion brands.",
  id: "fashion",
  name: "Fashion Demo Pack",
  version: "0.1.0"
};
