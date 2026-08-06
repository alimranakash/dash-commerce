"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type {
  StorefrontShopPageSettings,
  StorefrontShopPageSortOption
} from "../customization";

type ShopToolbarFacet = {
  id: string;
  name: string;
  slug: string;
};

type ShopToolbarProps = {
  brands: ShopToolbarFacet[];
  categories: ShopToolbarFacet[];
  productCount: number;
  settings: StorefrontShopPageSettings;
  tags: ShopToolbarFacet[];
};

const sortLabels: Record<StorefrontShopPageSortOption, string> = {
  "alpha-asc": "Alphabetically, A-Z",
  "alpha-desc": "Alphabetically, Z-A",
  "best-selling": "Best Selling",
  featured: "Featured",
  newest: "Newest",
  "price-asc": "Price Low -> High",
  "price-desc": "Price High -> Low"
};

export function ShopToolbar({ brands, categories, productCount, settings, tags }: ShopToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const rawSearchParams = useSearchParams();
  const searchParams = rawSearchParams ?? new URLSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const activeCategory = searchParams.get("category") ?? "";
  const activeAvailability = searchParams.get("availability") ?? "";
  const activeBrand = searchParams.get("brand") ?? "";
  const activeTag = searchParams.get("tag") ?? "";
  const activeSort = (searchParams.get("sort") || settings.defaultSort) as StorefrontShopPageSortOption;

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

  const resetFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    ["availability", "brand", "category", "maxPrice", "minPrice", "page", "tag"].forEach((key) => params.delete(key));
    setMinPrice("");
    setMaxPrice("");
    const query = params.toString();
    router.replace(`${pathname}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const applyPrice = () => {
    updateQuery({
      maxPrice: maxPrice.trim() || null,
      minPrice: minPrice.trim() || null
    });
  };

  return (
    <>
      <div className="sf-shop-toolbar">
        <div className="sf-shop-toolbar-left">
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
          <button aria-label="Close filters" className="sf-filter-drawer-backdrop" onClick={() => setDrawerOpen(false)} type="button" />
          <aside className="sf-filter-drawer" aria-label="Product filters">
            <div className="sf-filter-drawer-header">
              <div>
                <p>Filters</p>
                <h2>Refine products</h2>
              </div>
              <button aria-label="Close filters" onClick={() => setDrawerOpen(false)} type="button">
                <X className="h-4 w-4" />
              </button>
            </div>

            {settings.enableCategoryFilter ? (
              <FilterGroup title="Categories">
                <label>
                  <input
                    checked={!activeCategory}
                    name="shop-category"
                    onChange={() => updateQuery({ category: null })}
                    type="radio"
                  />
                  All categories
                </label>
                {categories.map((category) => (
                  <label key={category.id}>
                    <input
                      checked={activeCategory === category.slug}
                      name="shop-category"
                      onChange={() => updateQuery({ category: category.slug })}
                      type="radio"
                    />
                    {category.name}
                  </label>
                ))}
              </FilterGroup>
            ) : null}

            {settings.enablePriceFilter ? (
              <FilterGroup title="Price">
                <div className="sf-filter-price-row">
                  <input
                    inputMode="decimal"
                    onChange={(event) => setMinPrice(event.target.value)}
                    placeholder="Min"
                    type="text"
                    value={minPrice}
                  />
                  <input
                    inputMode="decimal"
                    onChange={(event) => setMaxPrice(event.target.value)}
                    placeholder="Max"
                    type="text"
                    value={maxPrice}
                  />
                </div>
                <button onClick={applyPrice} type="button">Apply price</button>
              </FilterGroup>
            ) : null}

            {settings.enableAvailabilityFilter ? (
              <FilterGroup title="Availability">
                <label>
                  <input
                    checked={!activeAvailability}
                    name="shop-availability"
                    onChange={() => updateQuery({ availability: null })}
                    type="radio"
                  />
                  All
                </label>
                <label>
                  <input
                    checked={activeAvailability === "in-stock"}
                    name="shop-availability"
                    onChange={() => updateQuery({ availability: "in-stock" })}
                    type="radio"
                  />
                  In stock
                </label>
                <label>
                  <input
                    checked={activeAvailability === "out-of-stock"}
                    name="shop-availability"
                    onChange={() => updateQuery({ availability: "out-of-stock" })}
                    type="radio"
                  />
                  Out of stock
                </label>
              </FilterGroup>
            ) : null}

            {settings.enableBrandFilter && brands.length > 0 ? (
              <FacetFilter
                activeSlug={activeBrand}
                items={brands}
                onSelect={(slug) => updateQuery({ brand: slug })}
                title="Brand"
              />
            ) : null}

            {settings.enableTagFilter && tags.length > 0 ? (
              <FacetFilter
                activeSlug={activeTag}
                items={tags}
                onSelect={(slug) => updateQuery({ tag: slug })}
                title="Tags"
              />
            ) : null}

            <div className="sf-filter-drawer-actions">
              <button onClick={resetFilters} type="button">Reset Filters</button>
              <button onClick={() => setDrawerOpen(false)} type="button">View Products</button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

function FilterGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="sf-filter-group">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function FacetFilter({
  activeSlug,
  items,
  onSelect,
  title
}: {
  activeSlug: string;
  items: ShopToolbarFacet[];
  onSelect: (slug: string | null) => void;
  title: string;
}) {
  return (
    <FilterGroup title={title}>
      <button className={activeSlug ? "" : "active"} onClick={() => onSelect(null)} type="button">
        All
      </button>
      {items.map((item) => (
        <button
          className={activeSlug === item.slug ? "active" : ""}
          key={item.id}
          onClick={() => onSelect(activeSlug === item.slug ? null : item.slug)}
          type="button"
        >
          {item.name}
        </button>
      ))}
    </FilterGroup>
  );
}
