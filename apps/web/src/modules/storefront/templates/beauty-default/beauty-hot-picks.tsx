import { storefrontBasePath } from "../../base-path";
import Link from "next/link";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontAdvancedSettings
} from "../../customization";
import type { StorefrontProduct } from "../../storefront.types";
import { BeautyListingCard } from "./beauty-listing-card";
import { BeautyHotPicksTabs, type BeautyHotPicksTab } from "./beauty-hot-picks-tabs";
import { toProductCardProduct } from "../../product-card-data";

const SECTION_ID = "beauty-hot-picks";

type BeautyHotPicksCategory = {
  id: string;
  name: string;
  slug: string;
};

export type BeautyHotPicksSectionProps = {
  advancedSettings?: StorefrontAdvancedSettings | null | undefined;
  categories: BeautyHotPicksCategory[];
  currency: string;
  // The homepage pools overlap heavily, so they are merged here rather than
  // picking one: a chip only filters what was already fetched, and a wider pool
  // is what keeps the per-category grids from running short.
  productPools: StorefrontProduct[][];
  storeId: string;
  storeSlug: string;
};

export async function BeautyHotPicksSection({
  advancedSettings,
  categories,
  currency,
  productPools,
  storeId,
  storeSlug
}: BeautyHotPicksSectionProps) {
  const basePath = await storefrontBasePath(storeSlug);
  const beauty = advancedSettings?.beauty ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.beauty;
  const products = mergeProductPools(productPools);

  if (products.length === 0) {
    return null;
  }

  // Only categories that actually have products become chips, so a chip is never
  // able to open an empty grid.
  const tabbedCategories = categories
    .map((category) => ({
      category,
      products: products.filter((product) => product.categoryId === category.id)
    }))
    .filter((entry) => entry.products.length > 0)
    .slice(0, beauty.hotPicksTabCount);

  const groups = tabbedCategories.length > 0 ? tabbedCategories : [{ category: null, products }];
  const tabs: BeautyHotPicksTab[] = groups.map((group, index) => ({
    label: group.category?.name ?? "All products",
    panelId: `${SECTION_ID}-panel-${index}`
  }));

  // The card reads only its badge / compare-price / hover-image flags off this,
  // so the seller's Featured settings carry over unchanged.
  const cardSection =
    advancedSettings?.productSections.featured ??
    DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.featured;
  const ctaHref = `${basePath}${beauty.hotPicksCtaLink.startsWith("/") ? beauty.hotPicksCtaLink : `/${beauty.hotPicksCtaLink}`}`;

  return (
    <section
      aria-labelledby={`${SECTION_ID}-title`}
      className="beauty-home-section beauty-hot-picks"
      id={SECTION_ID}
    >
      <div className="beauty-hot-picks-header">
        <div className="beauty-hot-picks-copy">
          <h2 className="beauty-hot-picks-title" id={`${SECTION_ID}-title`}>
            {beauty.hotPicksTitle}
          </h2>
          {beauty.hotPicksDescription ? <p>{beauty.hotPicksDescription}</p> : null}
        </div>
        {beauty.hotPicksCtaText ? (
          <Link className="beauty-hot-picks-cta" href={ctaHref}>
            {beauty.hotPicksCtaText} <span aria-hidden="true">&rsaquo;</span>
          </Link>
        ) : null}
      </div>
      <BeautyHotPicksTabs
        panels={groups.map((group, index) => (
          <div className="beauty-hot-picks-grid" key={tabs[index]?.panelId ?? index}>
            {group.products.slice(0, beauty.hotPicksProductCount).map((product) => (
              <BeautyListingCard
                currency={currency}
                key={product.id}
                product={toProductCardProduct(product)}
                section={cardSection}
                storeId={storeId}
                storeSlug={storeSlug}
              />
            ))}
          </div>
        ))}
        sectionId={SECTION_ID}
        tabs={tabs}
      />
    </section>
  );
}

function mergeProductPools(pools: StorefrontProduct[][]) {
  const seen = new Set<string>();

  return pools.flat().filter((product) => {
    if (seen.has(product.id)) {
      return false;
    }

    seen.add(product.id);

    return true;
  });
}
