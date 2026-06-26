import type { ReactNode } from "react";
import type { StorefrontStore } from "../../../storefront.types";
import { StorefrontFooter } from "../../../components/storefront-footer";
import { StorefrontHeader } from "../../../components/storefront-header";
import { createStorefrontThemeContext, getStorefrontThemeSettings } from "../../theme.service";
import { StorefrontThemeProvider } from "../../storefront-theme-provider";

export async function DefaultStorefrontLayout({
  children,
  store
}: {
  children: ReactNode;
  store: StorefrontStore;
}) {
  const settings = await getStorefrontThemeSettings(store.id);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const themeContext = createStorefrontThemeContext({
    settings,
    store
  });

  return (
    <StorefrontThemeProvider value={themeContext}>
      <div className="sf-page sf-foundation-layout" data-theme="default">
        <StorefrontHeader store={store} />
        <main>{children}</main>
        <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
      </div>
    </StorefrontThemeProvider>
  );
}
