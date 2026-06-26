import type { StorefrontThemeConfig } from "../types";

export const defaultStorefrontTheme: StorefrontThemeConfig = {
  defaultSettings: {
    announcementText: null,
    faviconUrl: null,
    featuredSectionTitle: "Products worth a closer look",
    heroImageUrl: null,
    heroSubtitle: null,
    heroTitle: "Discover what is new",
    logoUrl: null,
    primaryColor: "#135d66",
    secondaryColor: "#f5f1e8"
  },
  description: "A minimal, premium, fast, mobile-first storefront theme for modern commerce.",
  name: "Default Theme",
  previewImage: "/theme-previews/default-theme.png",
  sections: [
    "announcement",
    "header",
    "hero",
    "featured-products",
    "categories",
    "product-grid",
    "product-detail",
    "search",
    "cart",
    "checkout",
    "footer"
  ],
  slug: "default",
  version: "1.0.0"
};
