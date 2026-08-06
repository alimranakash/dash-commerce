import type { CSSProperties, ReactNode } from "react";
import type { StorefrontStore } from "../storefront.types";
import type { StorefrontAdvancedSettings } from "../customization";

export type StorefrontThemeSection =
  | "announcement"
  | "cart"
  | "categories"
  | "checkout"
  | "featured-products"
  | "footer"
  | "header"
  | "hero"
  | "product-detail"
  | "product-grid"
  | "search";

export type StorefrontThemeSettings = {
  announcementText: string | null;
  advancedSettings: StorefrontAdvancedSettings;
  faviconUrl: string | null;
  featuredSectionTitle: string;
  heroImageUrl: string | null;
  heroSubtitle: string | null;
  heroTitle: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export type StorefrontBranding = {
  contactEmail: string | null;
  contactPhone: string | null;
  logoUrl: string | null;
  socialLinks: {
    facebookUrl: string | null;
    instagramUrl: string | null;
    whatsappNumber: string | null;
  };
};

export type StorefrontThemeConfig = {
  defaultSettings: StorefrontThemeSettings;
  description: string;
  name: string;
  previewImage: string;
  sections: StorefrontThemeSection[];
  slug: string;
  version: string;
};

export type StorefrontThemeContextValue = {
  branding: StorefrontBranding;
  colors: {
    background: string;
    primary: string;
    secondary: string;
    text: string;
  };
  settings: StorefrontThemeSettings;
  store: StorefrontStore;
  theme: StorefrontThemeConfig;
};

export type StorefrontThemeProviderProps = {
  children: ReactNode;
  value: StorefrontThemeContextValue;
};

export type StorefrontThemeStyle = CSSProperties & {
  "--store-bg": string;
  "--store-primary": string;
  "--store-secondary": string;
  "--store-text": string;
  "--sf-boxed-max-width": string;
  "--sf-page-bg": string;
  "--sf-primary": string;
  "--sf-section-padding": string;
};
