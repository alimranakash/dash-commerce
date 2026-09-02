import { NotificationBarSlot } from "../../../../modules/notification-bar/components/notification-bar-slot";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { CategorySection } from "../../../../modules/storefront/components/category-section";
import { DEFAULT_STOREFRONT_ADVANCED_SETTINGS } from "../../../../modules/storefront/customization";
import { StorefrontFooter } from "../../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../../modules/storefront/components/storefront-header";
import { storefrontCanonicalUrl, toMetaDescription } from "../../../../modules/seo/page-metadata";
import {
  getStorefrontBySlug,
  getStorefrontCategories,
  requireStorefrontBySlug
} from "../../../../modules/storefront/resolver";
import { getStorefrontTemplateForStore } from "../../../../modules/storefront/templates/registry";
import { getStorefrontThemeSettings } from "../../../../modules/storefront/themes/theme.service";

type StorefrontCategoriesPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export async function generateMetadata({
  params
}: StorefrontCategoriesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const store = await getStorefrontBySlug(slug);

  if (!store) {
    return {};
  }

  const canonical = storefrontCanonicalUrl(store, "/categories");
  const description = toMetaDescription(
    store.setting?.tagline,
    `Browse the collections ${store.name} sells.`
  );
  const title = `Categories | ${store.name}`;

  return {
    alternates: {
      canonical
    },
    description,
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

export default async function StorefrontCategoriesPage({ params }: StorefrontCategoriesPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const template = getStorefrontTemplateForStore(store);
  const settings = await getStorefrontThemeSettings(store.id);
  // Same shell as /products and /categories/[slug]: the Pages -> Shop width,
  // spacing and column settings own this band too, so the three listing pages
  // line up instead of the collection index sitting in its own 1240px column.
  const shopSettings =
    settings.advancedSettings.shopPage ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.shopPage;
  const categories = await getStorefrontCategories(store.id);

  return (
    <main className="sf-page" data-storefront-template={template.id}>
      <StorefrontHeader store={store} />
      <NotificationBarSlot anchor="top" store={store} surface="other" />
      <section className="sf-shop-page-header" aria-labelledby="categories-title">
        <p>Categories</p>
        <span>Browse collections from {store.name}.</span>
      </section>
      <section
        className={`sf-shop-page sf-shop-page-${shopSettings.widthMode}`}
        style={
          {
            "--shop-grid-gap": `${shopSettings.gridSpacing}px`,
            "--shop-section-spacing": `${shopSettings.sectionSpacing}px`
          } as CSSProperties
        }
        aria-labelledby="categories-title"
      >
        <h1 className="sr-only" id="categories-title">
          Categories
        </h1>
        <CategorySection bare categories={categories} storeSlug={store.slug} />
      </section>
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}
