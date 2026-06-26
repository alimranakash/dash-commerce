import type { StorefrontStore } from "../storefront.types";
import { defaultStorefrontTheme } from "./default/theme";

export type StorefrontTheme = typeof defaultStorefrontTheme;

export function getActiveStorefrontTheme(store: StorefrontStore): StorefrontTheme {
  const themeName = store.themeSetting?.themeName?.toLowerCase();

  if (themeName && themeName !== "default" && themeName !== "theme v1") {
    return defaultStorefrontTheme;
  }

  return defaultStorefrontTheme;
}
