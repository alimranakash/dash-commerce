import type { StorefrontThemeProviderProps, StorefrontThemeStyle } from "./types";

export function StorefrontThemeProvider({ children, value }: StorefrontThemeProviderProps) {
  const style: StorefrontThemeStyle = {
    "--sf-primary": value.colors.primary,
    "--store-bg": value.colors.background,
    "--store-primary": value.colors.primary,
    "--store-secondary": value.colors.secondary,
    "--store-text": value.colors.text
  };

  return (
    <div
      className="sf-theme-scope"
      data-storefront-theme={value.theme.slug}
      data-storefront-theme-version={value.theme.version}
      style={style}
    >
      {children}
    </div>
  );
}
