"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import type {
  StorefrontShopPageSettings,
  StorefrontShopPageSortOption
} from "../customization";

type ShopToolbarCategory = {
  id: string;
  name: string;
  slug: string;
};

type ShopToolbarProps = {
  categories: ShopToolbarCategory[];
  productCount: number;
  settings: StorefrontShopPageSettings;
  storeName: string;
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

export function ShopToolbar({ categories, productCount, settings, storeName }: ShopToolbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const rawSearchParams = useSearchParams();
  const searchParams = rawSearchParams ?? new URLSearchParams();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const activeCategory = searchParams.get("category") ?? "";
  const activeAvailability = searchParams.get("availability") ?? "";
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
    ["availability", "category", "maxPrice", "minPrice", "page"].forEach((key) => params.delete(key));
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

            {settings.enableCollectionFilter ? (
              <FilterGroup title="Collections">
                <button className="active" type="button">All products</button>
                <button type="button">Seasonal edit</button>
                <button type="button">Daily essentials</button>
              </FilterGroup>
            ) : null}

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

            {settings.enableBrandFilter ? (
              <FilterGroup title="Brand">
                <button className="active" type="button">{storeName}</button>
              </FilterGroup>
            ) : null}

            {settings.enableColorFilter ? <FutureFilter title="Color" values={["Black", "White", "Natural"]} /> : null}
            {settings.enableSizeFilter ? <FutureFilter title="Size" values={["Small", "Medium", "Large"]} /> : null}
            {settings.enableTagFilter ? <FutureFilter title="Tags" values={["New", "Sale", "Essential"]} /> : null}

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

function FutureFilter({ title, values }: { title: string; values: string[] }) {
  return (
    <FilterGroup title={title}>
      {values.map((value) => (
        <button disabled key={value} type="button">
          {value}
        </button>
      ))}
    </FilterGroup>
  );
}
