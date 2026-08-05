import type { StorefrontProductSectionSettings } from "./customization";
import type { StorefrontProduct } from "./storefront.types";

// The product sets a section can be pointed at from the "Product source"
// select. A surface only fills the pools it can actually supply.
export type StorefrontProductPools = {
  "best-sellers"?: StorefrontProduct[] | undefined;
  featured?: StorefrontProduct[] | undefined;
  "new-arrivals"?: StorefrontProduct[] | undefined;
  related?: StorefrontProduct[] | undefined;
  trending?: StorefrontProduct[] | undefined;
};

export function resolveProductSectionProducts(
  section: StorefrontProductSectionSettings,
  pools: StorefrontProductPools
): StorefrontProduct[] {
  const selected = pools[sourcePoolKey(section.source)];

  if (selected && selected.length > 0) {
    return selected.slice(0, section.count);
  }

  // A store with no orders has no best sellers and no trending products, so an
  // empty pool falls back to the featured set rather than dropping the row.
  return (pools.featured ?? []).slice(0, section.count);
}

export function storefrontSectionHref(storeSlug: string, href: string) {
  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("#")) {
    return href;
  }

  return `/s/${storeSlug}${href === "/" ? "" : href.startsWith("/") ? href : `/${href}`}`;
}

function sourcePoolKey(source: StorefrontProductSectionSettings["source"]): keyof StorefrontProductPools {
  if (source === "best-sellers" || source === "new-arrivals" || source === "trending" || source === "related") {
    return source;
  }

  // "manual", "search" and "recently-viewed" have no server-side pool of their
  // own on the surfaces that use this helper.
  return "featured";
}
