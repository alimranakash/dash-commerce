import type { DemoPack } from "../types";
import { electronicsDemoCategories } from "./categories";
import { electronicsDemoCollections } from "./collections";
import { electronicsDemoHomepage } from "./homepage";
import { electronicsDemoMedia } from "./media";
import { electronicsDemoNavigation } from "./navigation";
import { electronicsDemoPages } from "./pages";
import { electronicsDemoProducts } from "./products";
import { electronicsDemoSettings } from "./settings";

export const electronicsDemoPack: DemoPack = {
  businessType: "Electronics",
  compatibleTemplate: "electronics-default",
  content: {
    categories: electronicsDemoCategories,
    collections: electronicsDemoCollections,
    homepage: electronicsDemoHomepage,
    media: electronicsDemoMedia,
    navigation: electronicsDemoNavigation,
    pages: electronicsDemoPages,
    products: electronicsDemoProducts,
    settings: electronicsDemoSettings
  },
  description: "Starter demo architecture for gadgets, devices, and electronics stores.",
  id: "electronics",
  name: "Electronics Demo Pack",
  version: "0.1.0"
};
