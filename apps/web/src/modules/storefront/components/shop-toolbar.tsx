"use client";

import { SlidersHorizontal } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { StorefrontShopPageSettings, StorefrontShopPageSortOption } from "../customization";
import type { ShopFilterLayout } from "../shop-filters";
import type { ShopFilterFacet } from "./shop-filter-panel";
import { ShopFilterPanel } from "./shop-filter-panel";

type ShopToolbarProps = {
  brands: ShopFilterFacet[];
  categories: ShopFilterFacet[];
  /**
   * The layout the page resolved, not the raw seller setting. On `sidebar` the
   * panel is already on screen, so the button here is only the phone-sized
   * fallback the CSS reveals once the column collapses.
   */
  filterLayout: ShopFilterLayout;
  productCount: number;
  settings: StorefrontShopPageSettings;
  tags: ShopFilterFacet[];
};

const sortLabels: Record<StorefrontShopPageSortOption, string> = {
  "alpha-asc": "Alphabetically, A-Z",
  "alpha-desc": "Alphabetically, Z-A",
  "best-selling": "Best Selling",
  featured: "Featured",
  newest: "Newest",
  "price-asc": "Price Low -> High",
  "price-desc": "Price High -> Low",
  relevance: "Relevance"
};

export function ShopToolbar({
  brands,
  categories,
  filterLayout,
  productCount,
  settings,
  tags
}: ShopToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const rawSearchParams = useSearchParams();
  const searchParams = rawSearchParams ?? new URLSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const activeSort = (searchParams.get("sort") ||
    settings.defaultSort) as StorefrontShopPageSortOption;

  const enabledSortOptions = useMemo(
    () => settings.sortOptions.filter((option) => Boolean(sortLabels[option])),
    [settings.sortOptions]
  );

  const updateQuery = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    Object.entries(updates).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });

    params.delete("page");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  return (
    <>
      <div className="sf-shop-toolbar">
        <div className="sf-shop-toolbar-left" data-filter-layout={filterLayout}>
          {settings.enableFilters ? (
            <button onClick={() => setDrawerOpen(true)} type="button">
              <SlidersHorizontal className="h-4 w-4" />
              <span>Show Filters</span>
            </button>
          ) : null}
        </div>
        <div className="sf-shop-toolbar-center">
          {settings.enableResultCounter ? <span>Showing all {productCount} results</span> : null}
        </div>
        <div className="sf-shop-toolbar-right">
          {settings.enableSorting ? (
            <label>
              <span>Sort by:</span>
              <select
                aria-label="Sort products"
                onChange={(event) => updateQuery({ sort: event.target.value })}
                value={activeSort}
              >
                {enabledSortOptions.map((option) => (
                  <option key={option} value={option}>
                    {sortLabels[option]}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>
      </div>

      {drawerOpen ? (
        <div className="sf-filter-drawer-shell" role="presentation">
          <button
            aria-label="Close filters"
            className="sf-filter-drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
            type="button"
          />
          <ShopFilterPanel
            brands={brands}
            categories={categories}
            onClose={() => setDrawerOpen(false)}
            settings={settings}
            tags={tags}
            variant="drawer"
          />
        </div>
      ) : null}
    </>
  );
}
