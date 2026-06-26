import type { Metadata } from "next";
import type { ReactNode } from "react";
import { StorefrontThemeProvider } from "../../../modules/storefront/themes/storefront-theme-provider";
import {
  createStorefrontThemeContext,
  getStorefrontThemeSettings
} from "../../../modules/storefront/themes/theme.service";
import { getPrimaryStorefrontDomain, getStorefrontBySlug } from "../../../modules/storefront/resolver";

type StorefrontLayoutProps = {
  children: ReactNode;
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({ params }: StorefrontLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStorefrontBySlug(slug);

  if (!store) {
    return {
      title: "Storefront not found | Dash Commerce OS"
    };
  }

  const primaryDomain = getPrimaryStorefrontDomain(store);
  const title = `${store.name} | Dash Commerce OS`;
  const description =
    store.themeSetting?.heroSubtitle ?? store.setting?.tagline ?? `Shop ${store.name} online.`;
  const canonical = primaryDomain ? `https://${primaryDomain.domain}` : `/s/${store.slug}`;

  return {
    alternates: {
      canonical
    },
    description,
    ...(store.setting?.faviconUrl
      ? {
          icons: {
            icon: store.setting.faviconUrl,
            shortcut: store.setting.faviconUrl
          }
        }
      : {}),
    openGraph: {
      description,
      siteName: store.name,
      title,
      type: "website",
      url: canonical
    },
    title
  };
}

export default async function StorefrontLayout({ children, params }: StorefrontLayoutProps) {
  const { slug } = await params;
  const store = await getStorefrontBySlug(slug);

  if (!store) {
    return <div data-storefront-layout="true">{children}</div>;
  }

  const settings = await getStorefrontThemeSettings(store.id);
  const themeContext = createStorefrontThemeContext({
    settings,
    store
  });

  return (
    <StorefrontThemeProvider value={themeContext}>
      {children}
    </StorefrontThemeProvider>
  );
}
