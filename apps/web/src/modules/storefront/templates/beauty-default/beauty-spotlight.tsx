import { storefrontBasePath } from "../../base-path";
import Link from "next/link";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontAdvancedSettings
} from "../../customization";
import type { StorefrontProduct } from "../../storefront.types";
import { BeautyListingCard } from "./beauty-listing-card";

const SECTION_ID = "beauty-spotlight";

type BeautySpotlightCategory = {
  id: string;
  name: string;
  slug: string;
};

export type BeautySpotlightSectionProps = {
  advancedSettings?: StorefrontAdvancedSettings | null | undefined;
  categories: BeautySpotlightCategory[];
  currency: string;
  // Only used when the spotlight image is not configured yet, same fallback the
  // curated promo card uses.
  fallbackImageUrl?: string | null | undefined;
  // The homepage pools overlap, so they are merged here: the band only needs a
  // handful of products and a wider pool is what keeps the 2x2 grid full when the
  // configured category is thin.
  productPools: StorefrontProduct[][];
  storeId: string;
  storeSlug: string;
};

export async function BeautySpotlightSection({
  advancedSettings,
  categories,
  currency,
  fallbackImageUrl,
  productPools,
  storeId,
  storeSlug
}: BeautySpotlightSectionProps) {
  const basePath = await storefrontBasePath(storeSlug);
  const beauty = advancedSettings?.beauty ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.beauty;
  const pool = mergeProductPools(productPools);
  const products = resolveSpotlightProducts({
    categories,
    categorySlug: beauty.spotlightCategorySlug,
    count: beauty.spotlightProductCount,
    pool
  });

  if (products.length === 0) {
    return null;
  }

  // The card reads only its badge / compare-price / hover-image flags off this,
  // so the seller's Featured settings carry over unchanged.
  const cardSection =
    advancedSettings?.productSections.featured ??
    DEFAULT_STOREFRONT_ADVANCED_SETTINGS.productSections.featured;
  const image = beauty.spotlightImageUrl || fallbackImageUrl || "";
  const ctaHref = `${basePath}${beauty.spotlightCtaLink.startsWith("/") ? beauty.spotlightCtaLink : `/${beauty.spotlightCtaLink}`}`;

  return (
    <section
      aria-labelledby={`${SECTION_ID}-title`}
      className="beauty-home-section beauty-spotlight"
      id={SECTION_ID}
    >
      <div className="beauty-spotlight-layout">
        <div className="beauty-spotlight-panel">
          {image ? (
            // Decorative backdrop: the headline beside it already names the
            // collection, so it stays out of the a11y tree.
            <img alt="" className="beauty-spotlight-image" loading="lazy" src={image} />
          ) : null}
          <div className="beauty-spotlight-copy">
            <h2 className="beauty-spotlight-title" id={`${SECTION_ID}-title`}>
              {beauty.spotlightTitle}
            </h2>
            {beauty.spotlightDescription ? (
              <p className="beauty-spotlight-description">{beauty.spotlightDescription}</p>
            ) : null}
          </div>
          {beauty.spotlightCtaText ? (
            <Link className="beauty-spotlight-cta" href={ctaHref}>
              {beauty.spotlightCtaText} <span aria-hidden="true">&rsaquo;</span>
            </Link>
          ) : null}
        </div>
        <div className="beauty-spotlight-grid">
          {products.map((product) => (
            <BeautyListingCard
              currency={currency}
              key={product.id}
              product={product}
              section={cardSection}
              storeId={storeId}
              storeSlug={storeSlug}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

// A configured category wins, but only while it actually fills the grid; below
// that the band tops up from the wider pool rather than rendering a short row.
function resolveSpotlightProducts({
  categories,
  categorySlug,
  count,
  pool
}: {
  categories: BeautySpotlightCategory[];
  categorySlug: string;
  count: number;
  pool: StorefrontProduct[];
}) {
  const category = categorySlug
    ? categories.find((entry) => entry.slug === categorySlug)
    : undefined;
  const preferred = category ? pool.filter((product) => product.categoryId === category.id) : [];
  const seen = new Set(preferred.map((product) => product.id));
  const filler = pool.filter((product) => !seen.has(product.id));

  return [...preferred, ...filler].slice(0, count);
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
