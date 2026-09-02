import { NotificationBarSlot } from "../../../../modules/notification-bar/components/notification-bar-slot";
import type { Metadata } from "next";
import { storefrontBasePath } from "../../../../modules/storefront/base-path";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../../../modules/storefront/customization";
import { requireStorefrontBySlug } from "../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../../modules/storefront/themes/theme.service";
import { WishlistPage } from "../../../../modules/wishlist/components/wishlist-page";
import { getWishlist } from "../../../../modules/wishlist/wishlist.service";

type StorefrontWishlistPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams: Promise<{
    cleared?: string;
    removed?: string;
    saved?: string;
    wishlistError?: string;
  }>;
};

/**
 * No canonical, and `noindex` instead.
 *
 * Every other storefront page canonicalises to an address a crawler should hold;
 * this one is one shopper's cookie rendered as a page, so there is nothing here
 * that is the same document twice. It is disallowed in `robots.ts` for the same
 * reason and left out of the sitemap — the three have to agree, and
 * `verify:sitemap` checks that they do.
 */
export const metadata: Metadata = {
  robots: {
    follow: false,
    index: false
  },
  title: "Wishlist"
};

export default async function StorefrontWishlistPage({
  params,
  searchParams
}: StorefrontWishlistPageProps) {
  const { slug } = await params;
  const feedback = await searchParams;
  const store = await requireStorefrontBySlug(slug);
  const basePath = await storefrontBasePath(store.slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const template = getStorefrontTemplateForStore(store);
  const [settings, wishlist] = await Promise.all([
    getStorefrontThemeSettings(store.id),
    getWishlist(store.id)
  ]);
  const shopSettings =
    settings.advancedSettings.shopPage ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.shopPage;
  // The same listing section the shop builds, so a seller's column count, badge
  // and hover-image choices reach this grid too rather than it having opinions
  // of its own.
  const listingSection = {
    ...(settings.advancedSettings.productSections?.listing ??
      DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.listing),
    columns: shopSettings.productsPerRow,
    count: wishlist.count,
    enableBadges: shopSettings.enableProductBadges,
    enableComparePrice: shopSettings.enableComparePrice,
    enableHoverImage: shopSettings.enableHoverImage
  };

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <NotificationBarSlot anchor="top" store={store} surface="other" />
      <WishlistPage
        basePath={basePath}
        cardVariant={template.productCardVariant}
        currency={store.currency}
        feedback={feedback}
        listingSection={listingSection}
        shopSettings={shopSettings}
        storeId={store.id}
        storeName={store.name}
        storeSlug={store.slug}
        wishlist={wishlist}
      />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
