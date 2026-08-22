import { storeSubdomain } from "../../../lib/host-routing";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MarketingTags } from "../../../modules/marketing/components/marketing-tags";
import {
  getMarketingMetaTags,
  getMarketingTagPlan
} from "../../../modules/marketing/marketing.service";
import { storefrontBasePath } from "../../../modules/storefront/base-path";
import { StorefrontBasePathProvider } from "../../../modules/storefront/base-path-provider";
import { ScrollToTopButton } from "../../../modules/storefront/components/scroll-to-top-button";
import { StorefrontThemeProvider } from "../../../modules/storefront/themes/storefront-theme-provider";
import {
  createStorefrontThemeContext,
  getStorefrontThemeSettings
} from "../../../modules/storefront/themes/theme.service";
import {
  getPrimaryStorefrontDomain,
  getStorefrontBySlug
} from "../../../modules/storefront/resolver";

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
      title: "Storefront not found | StoreIM"
    };
  }

  const primaryDomain = getPrimaryStorefrontDomain(store);
  const title = `${store.name} | StoreIM`;
  const description =
    store.themeSetting?.heroSubtitle ?? store.setting?.tagline ?? `Shop ${store.name} online.`;
  // A canonical URL has to be absolute; the internal `/s/<slug>` path is not an
  // address any shopper or crawler should be pointed at.
  const canonical = primaryDomain
    ? `https://${primaryDomain.domain}`
    : `https://${storeSubdomain(store.slug)}`;
  const verification = await getMarketingMetaTags(store.id);

  return {
    alternates: {
      canonical
    },
    description,
    ...(verification ? { other: verification } : {}),
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

  const [settings, marketing] = await Promise.all([
    getStorefrontThemeSettings(store.id),
    getMarketingTagPlan(store.id)
  ]);
  const basePath = await storefrontBasePath(store.slug);
  const themeContext = createStorefrontThemeContext({
    settings,
    store
  });

  return (
    <StorefrontThemeProvider value={themeContext}>
      <StorefrontBasePathProvider value={basePath}>
        {/* Analytics only ever mounts on a storefront surface — never on /dashboard
          or /admin, which render outside this layout entirely. */}
        <MarketingTags tags={marketing.head} />
        <MarketingTags tags={marketing.bodyStart} />
        {children}
        {/* Inside the theme scope so the fixed button inherits this store's colour
          tokens and template attribute; mounted here, once, instead of per footer. */}
        <ScrollToTopButton />
        <MarketingTags tags={marketing.bodyEnd} />
      </StorefrontBasePathProvider>
    </StorefrontThemeProvider>
  );
}
