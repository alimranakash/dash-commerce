import { defaultStorefrontTheme } from "./default/config";
import type { StorefrontThemeConfig } from "./types";

export const storefrontThemeRegistry = {
  [defaultStorefrontTheme.slug]: defaultStorefrontTheme
} satisfies Record<string, StorefrontThemeConfig>;

export function getStorefrontThemeBySlug(slug: string | null | undefined): StorefrontThemeConfig {
  if (!slug) {
    return defaultStorefrontTheme;
  }

  const normalizedSlug = normalizeThemeSlug(slug);
  return storefrontThemeRegistry[normalizedSlug] ?? defaultStorefrontTheme;
}

export function getAvailableStorefrontThemes() {
  return Object.values(storefrontThemeRegistry);
}

function normalizeThemeSlug(value: string) {
  const normalized = value.toLowerCase().trim();

  if (normalized === "theme v1") {
    return defaultStorefrontTheme.slug;
  }

  return normalized.replace(/\s+/g, "-");
}
