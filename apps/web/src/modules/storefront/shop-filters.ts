import type { StorefrontShopPageSettings } from "./customization";

export type ShopFilterLayout = StorefrontShopPageSettings["filterLayout"];

/** How many facet rows a listing page actually has to offer. */
export type ShopFilterFacetCounts = {
  brands: number;
  tags: number;
};

/**
 * Whether the filter panel would render a single control. The drawer can afford
 * not to ask — it does not exist until a shopper opens it — but the sidebar is a
 * *column*, so a seller who left the layout on `sidebar` and then switched every
 * individual filter off must get the one-column page back rather than an empty
 * rail beside the grid.
 */
export function hasShopFilterFields(
  settings: StorefrontShopPageSettings,
  facets: ShopFilterFacetCounts
) {
  if (!settings.enableFilters) {
    return false;
  }

  return (
    settings.enableCategoryFilter ||
    settings.enablePriceFilter ||
    settings.enableAvailabilityFilter ||
    (settings.enableBrandFilter && facets.brands > 0) ||
    (settings.enableTagFilter && facets.tags > 0)
  );
}

/**
 * The layout a listing page renders, which is the seller's choice narrowed by
 * what there is to show. Every surface that lays out a grid asks this rather
 * than reading `settings.filterLayout`, so "sidebar" means the same thing on the
 * shop, a category and a search result.
 */
export function resolveShopFilterLayout(
  settings: StorefrontShopPageSettings,
  facets: ShopFilterFacetCounts
): ShopFilterLayout {
  return settings.filterLayout === "sidebar" && hasShopFilterFields(settings, facets)
    ? "sidebar"
    : "drawer";
}
