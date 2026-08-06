import type { StorefrontThemeProviderProps, StorefrontThemeStyle } from "./types";

export function StorefrontThemeProvider({ children, value }: StorefrontThemeProviderProps) {
  // Colors & Layout is a single scope-level contract: the panel writes CSS
  // variables here and every surface inside the storefront reads them, so the
  // settings apply site-wide instead of per page.
  const layout = value.settings.advancedSettings.layout;
  const style: StorefrontThemeStyle = {
    "--sf-boxed-max-width": `${layout.boxedMaxWidth}px`,
    "--sf-page-bg": layout.pageBackgroundColor,
    "--sf-primary": value.colors.primary,
    "--sf-section-padding": `${layout.sectionPadding}px`,
    "--store-bg": layout.pageBackgroundColor,
    "--store-primary": value.colors.primary,
    "--store-secondary": value.colors.secondary,
    "--store-text": value.colors.text
  };

  return (
    <div
      className="sf-theme-scope"
      data-storefront-template={value.store.activeTemplate ?? "general-default"}
      data-storefront-theme={value.theme.slug}
      data-storefront-theme-version={value.theme.version}
      data-storefront-width={layout.widthMode}
      style={style}
    >
      {children}
    </div>
  );
}
