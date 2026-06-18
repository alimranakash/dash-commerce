import type { CSSProperties } from "react";
import { CategorySection } from "../../../modules/storefront/components/category-section";
import { FeaturedProducts } from "../../../modules/storefront/components/featured-products";
import { HeroSection } from "../../../modules/storefront/components/hero-section";
import { StorefrontFooter } from "../../../modules/storefront/components/storefront-footer";
import { StorefrontHeader } from "../../../modules/storefront/components/storefront-header";
import { TrustBadges } from "../../../modules/storefront/components/trust-badges";
import { getStorefrontHomeData, requireStorefrontBySlug } from "../../../modules/storefront/resolver";

type StorefrontPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { slug } = await params;
  const store = await requireStorefrontBySlug(slug);
  const primaryDomain = store.domains.find((domain) => domain.isPrimary) ?? store.domains[0];
  const homeData = await getStorefrontHomeData(store.id);
  const themeStyle = storefrontThemeStyle(store.themeSetting?.primaryColor);

  return (
    <main className="sf-page" style={themeStyle}>
      <StorefrontHeader store={store} />
      <HeroSection primaryDomain={primaryDomain?.domain} store={store} />
      <FeaturedProducts
        currency={store.currency}
        heading={store.themeSetting?.featuredSectionTitle}
        products={homeData.featuredProducts}
        storeSlug={store.slug}
      />
      <CategorySection categories={homeData.categories} />
      <TrustBadges />
      <StorefrontFooter primaryDomain={primaryDomain?.domain} store={store} />
    </main>
  );
}

function storefrontThemeStyle(primaryColor: string | null | undefined): CSSProperties | undefined {
  if (!primaryColor || !/^#[0-9a-fA-F]{6}$/.test(primaryColor)) {
    return undefined;
  }

  return {
    "--sf-primary": primaryColor
  } as CSSProperties;
}
