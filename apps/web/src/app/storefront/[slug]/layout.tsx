import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MarketingTags } from "../../../modules/marketing/components/marketing-tags";
import { NotificationBarDock } from "../../../modules/notification-bar/components/notification-bar-dock";
import {
  getMarketingMetaTags,
  getMarketingTagPlan
} from "../../../modules/marketing/marketing.service";
import { SalesNotificationDock } from "../../../modules/sales-notifications/components/sales-notification-dock";
import { storefrontCanonicalUrl } from "../../../modules/seo/page-metadata";
import { ShoppingAgentDock } from "../../../modules/shopping-agent/components/shopping-agent-dock";
import { storefrontBasePath } from "../../../modules/storefront/base-path";
import { StorefrontBasePathProvider } from "../../../modules/storefront/base-path-provider";
import { ScrollToTopButton } from "../../../modules/storefront/components/scroll-to-top-button";
import { ThemeModeProvider } from "../../../modules/theme-mode/components/theme-mode-provider";
import { StorefrontThemeProvider } from "../../../modules/storefront/themes/storefront-theme-provider";
import {
  createStorefrontThemeContext,
  getStorefrontThemeSettings
} from "../../../modules/storefront/themes/theme.service";
import { getStorefrontBySlug } from "../../../modules/storefront/resolver";
import { WishlistProvider } from "../../../modules/wishlist/components/wishlist-provider";
import { getWishlistState } from "../../../modules/wishlist/wishlist.service";

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

  const title = `${store.name} | StoreIM`;
  const description =
    store.themeSetting?.heroSubtitle ?? store.setting?.tagline ?? `Shop ${store.name} online.`;
  // A canonical URL has to be absolute; the internal `/s/<slug>` path is not an
  // address any shopper or crawler should be pointed at. Every page below this
  // layout now builds its own from the same helper: a page that inherited this
  // one told crawlers the product *was* the homepage, which would have made a
  // sitemap of those products worthless.
  const canonical = storefrontCanonicalUrl(store);
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

  const [settings, marketing, wishlist] = await Promise.all([
    getStorefrontThemeSettings(store.id),
    getMarketingTagPlan(store.id),
    // One read for every heart on the page. It costs a shopper who has saved
    // nothing nothing at all: with no wishlist cookie it never reaches the
    // database.
    getWishlistState(store.id)
  ]);
  const basePath = await storefrontBasePath(store.slug);
  const themeContext = createStorefrontThemeContext({
    settings,
    store
  });

  return (
    // A shopper's display preference, not a seller setting: it is read from this
    // browser and never from the store, so switching it changes nothing for the
    // next visitor and nothing about the shop's own colours.
    <ThemeModeProvider>
      <StorefrontThemeProvider value={themeContext}>
        <StorefrontBasePathProvider value={basePath}>
          {/* Every heart on every card and the header count read one list from
          here, so a grid of thirty products is one query rather than thirty. */}
          <WishlistProvider state={wishlist} storeSlug={store.slug}>
            {/* Analytics only ever mounts on a storefront surface — never on /dashboard
            or /admin, which render outside this layout entirely. */}
            <MarketingTags tags={marketing.head} />
            <MarketingTags tags={marketing.bodyStart} />
            {children}
            {/* Inside the theme scope so the fixed button inherits this store's colour
            tokens and template attribute; mounted here, once, instead of per footer. */}
            <ScrollToTopButton />
            {/* Once for the whole storefront, so the conversation survives a shopper
            moving from a category to a product to the cart. Renders nothing unless
            the seller switched the assistant on and the store is entitled to it. */}
            <ShoppingAgentDock store={store} />
            {/* Mounted once for the same reason: the queue keeps its place as the
            shopper moves between pages instead of restarting with the first
            card on every navigation. Renders nothing unless the seller switched
            it on, the plan grants it, and the shop has a real order to show. */}
            <SalesNotificationDock store={store} />
            {/* Mounted once so the bar survives a shopper moving between pages —
            remounted per navigation it would replay its entrance on every click
            and re-open for someone who had just closed it. Renders nothing
            unless the seller switched it on, the plan grants it, and its
            schedule is open right now. */}
            <NotificationBarDock store={store} />
            <MarketingTags tags={marketing.bodyEnd} />
          </WishlistProvider>
        </StorefrontBasePathProvider>
      </StorefrontThemeProvider>
    </ThemeModeProvider>
  );
}
