import type { ReactNode } from "react";
import type { StorefrontStore } from "../../../storefront.types";
import { StorefrontContainer } from "../../../primitives/container";
import {
  createStorefrontThemeContext,
  getStorefrontThemeSettings
} from "../../theme.service";
import { StorefrontThemeProvider } from "../../storefront-theme-provider";

export async function DefaultStorefrontLayout({ children, store }: { children: ReactNode; store: StorefrontStore }) {
  const settings = await getStorefrontThemeSettings(store.id);
  const themeContext = createStorefrontThemeContext({
    settings,
    store
  });

  return (
    <StorefrontThemeProvider value={themeContext}>
      <div className="sf-page sf-foundation-layout" data-theme="default">
        <header className="sf-foundation-header">
          <StorefrontContainer>
            <span>{store.name}</span>
            <small>{themeContext.theme.name}</small>
          </StorefrontContainer>
        </header>
        <main>{children}</main>
        <footer className="sf-foundation-footer">
          <StorefrontContainer>
            <span>{store.name}</span>
            <small>Footer placeholder</small>
          </StorefrontContainer>
        </footer>
      </div>
    </StorefrontThemeProvider>
  );
}
