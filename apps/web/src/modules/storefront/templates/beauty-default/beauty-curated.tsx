import { ProductGrid } from "../../components/product-listing";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontAdvancedSettings,
  type StorefrontProductSectionSettings
} from "../../customization";
import type { StorefrontProduct } from "../../storefront.types";
import { BEAUTY_PRODUCT_CARD_VARIANT } from "./beauty-listing-card";
import { BeautyCuratedPromo } from "./beauty-curated-promo";
import { BeautyCuratedTabs, type BeautyCuratedTab } from "./beauty-curated-tabs";

const SECTION_ID = "beauty-curated";

type BeautyCuratedCategory = {
  id: string;
  name: string;
  slug: string;
};

export type BeautyCuratedSectionProps = {
  advancedSettings?: StorefrontAdvancedSettings | null | undefined;
  categories: BeautyCuratedCategory[];
  currency: string;
  // Only used when the beauty promo card has no images of its own.
  fallbackImageUrl?: string | null | undefined;
  products: StorefrontProduct[];
  storeId: string;
  storeSlug: string;
};

export function BeautyCuratedSection({
  advancedSettings,
  categories,
  currency,
  fallbackImageUrl,
  products,
  storeId,
  storeSlug
}: BeautyCuratedSectionProps) {
  const beauty = advancedSettings?.beauty ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.beauty;

  if (products.length === 0) {
    return null;
  }

  // Only categories that actually have something to show become tabs, so a tab is
  // never able to open an empty grid.
  const tabbedCategories = categories
    .map((category) => ({
      category,
      products: products.filter((product) => product.categoryId === category.id)
    }))
    .filter((entry) => entry.products.length > 0)
    .slice(0, beauty.curatedTabCount);

  const groups = tabbedCategories.length > 0 ? tabbedCategories : [{ category: null, products }];
  const gridSection: StorefrontProductSectionSettings = {
    ...(advancedSettings?.productSections.featured ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.featured),
    columns: 3,
    count: beauty.curatedProductsPerTab,
    mode: "grid"
  };

  const tabs: BeautyCuratedTab[] = groups.map((group, index) => ({
    label: group.category?.name ?? "All products",
    panelId: `${SECTION_ID}-panel-${index}`
  }));

  const promoImages =
    beauty.curatedPromoImageUrls.length > 0
      ? beauty.curatedPromoImageUrls
      : fallbackImageUrl
        ? [fallbackImageUrl]
        : [];
  const promoCtaHref = `/s/${storeSlug}${beauty.curatedPromoCtaLink.startsWith("/") ? beauty.curatedPromoCtaLink : `/${beauty.curatedPromoCtaLink}`}`;

  return (
    <section aria-labelledby={`${SECTION_ID}-title`} className="beauty-home-section beauty-curated" id={SECTION_ID}>
      <div className="beauty-curated-layout">
        <BeautyCuratedPromo
          ctaHref={promoCtaHref}
          ctaText={beauty.curatedPromoCtaText}
          eyebrow={beauty.curatedPromoEyebrow}
          images={promoImages}
          title={beauty.curatedPromoTitle}
        />
        <BeautyCuratedTabs
          panels={groups.map((group, index) => (
            <ProductGrid
              cardVariant={BEAUTY_PRODUCT_CARD_VARIANT}
              currency={currency}
              gridId={`${SECTION_ID}-grid-${index}`}
              key={tabs[index]?.panelId ?? index}
              products={group.products}
              section={gridSection}
              storeId={storeId}
              storeSlug={storeSlug}
            />
          ))}
          sectionId={SECTION_ID}
          tabs={tabs}
          title={beauty.curatedTitle}
          titleId={`${SECTION_ID}-title`}
        />
      </div>
    </section>
  );
}
