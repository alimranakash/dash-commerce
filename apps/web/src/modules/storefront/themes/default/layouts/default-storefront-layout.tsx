import type { ReactNode } from "react";
import type { StorefrontStore } from "../../../storefront.types";
import { StorefrontContainer } from "../../../primitives/container";
import { StorefrontHeader } from "../../../components/storefront-header";
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
        <StorefrontHeader store={store} />
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
