"use client";

import { X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import type { StorefrontShopPageSettings } from "../customization";
import type { ShopFilterLayout } from "../shop-filters";

export type ShopFilterFacet = {
  id: string;
  name: string;
  slug: string;
};

type ShopFilterPanelProps = {
  brands: ShopFilterFacet[];
  categories: ShopFilterFacet[];
  onClose?: (() => void) | undefined;
  settings: StorefrontShopPageSettings;
  tags: ShopFilterFacet[];
  variant: ShopFilterLayout;
};

/**
 * The filters themselves, in either container. The drawer and the sidebar are
 * two places to put one panel rather than two panels, so there is one copy of
 * every control and one copy of the query rewriting behind them.
 *
 * State is the URL, not this component, so the sidebar on a wide viewport and
 * the drawer the layout collapses into cannot disagree with each other or with
 * the products on screen.
 */
export function ShopFilterPanel({
  brands,
  categories,
  onClose,
  settings,
  tags,
  variant
}: ShopFilterPanelProps) {
  const pathname = usePathname();
  const router = useRouter();
  const rawSearchParams = useSearchParams();
  const searchParams = rawSearchParams ?? new URLSearchParams();
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const activeCategory = searchParams.get("category") ?? "";
  const activeAvailability = searchParams.get("availability") ?? "";
  const activeBrand = searchParams.get("brand") ?? "";
  const activeTag = searchParams.get("tag") ?? "";
  const isDrawer = variant === "drawer";
  // Read from the URL rather than the price drafts above, so typing into a box
  // and not applying it does not count as a narrowed page.
  const hasActiveFilters = [
    "availability",
    "brand",
    "category",
    "maxPrice",
    "minPrice",
    "tag"
  ].some((key) => searchParams.get(key));

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
    ["availability", "brand", "category", "maxPrice", "minPrice", "page", "tag"].forEach((key) =>
      params.delete(key)
    );
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
    <aside
      aria-label="Product filters"
      className={isDrawer ? "sf-filter-drawer" : "sf-filter-sidebar"}
    >
      {isDrawer ? (
        <div className="sf-filter-drawer-header">
          <div>
            <p>Filters</p>
            <h2>Refine products</h2>
          </div>
          <button aria-label="Close filters" onClick={onClose} type="button">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        /* The sidebar is already open and already framed by the column it sits
           in, so it takes one line where the drawer needs an eyebrow and a
           title to introduce itself. The reset comes up here too, and only once
           there is something to reset — a Clear all beside an untouched panel is
           a control that does nothing. */
        <div className="sf-filter-sidebar-header">
          <h2>Filters</h2>
          {hasActiveFilters ? (
            <button onClick={resetFilters} type="button">
              Clear all
            </button>
          ) : null}
        </div>
      )}

      {settings.enableCategoryFilter ? (
        <FilterGroup title="Categories">
          <label>
            <input
              checked={!activeCategory}
              name={`${variant}-category`}
              onChange={() => updateQuery({ category: null })}
              type="radio"
            />
            All categories
          </label>
          {categories.map((category) => (
            <label key={category.id}>
              <input
                checked={activeCategory === category.slug}
                name={`${variant}-category`}
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
          <button onClick={applyPrice} type="button">
            Apply price
          </button>
        </FilterGroup>
      ) : null}

      {settings.enableAvailabilityFilter ? (
        <FilterGroup title="Availability">
          <label>
            <input
              checked={!activeAvailability}
              name={`${variant}-availability`}
              onChange={() => updateQuery({ availability: null })}
              type="radio"
            />
            All
          </label>
          <label>
            <input
              checked={activeAvailability === "in-stock"}
              name={`${variant}-availability`}
              onChange={() => updateQuery({ availability: "in-stock" })}
              type="radio"
            />
            In stock
          </label>
          <label>
            <input
              checked={activeAvailability === "out-of-stock"}
              name={`${variant}-availability`}
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

      {isDrawer ? (
        <div className="sf-filter-drawer-actions">
          <button onClick={resetFilters} type="button">
            Reset Filters
          </button>
          <button onClick={onClose} type="button">
            View Products
          </button>
        </div>
      ) : null}
    </aside>
  );
}

/**
 * The sidebar half, mounted straight from a listing page. It takes no `onClose`
 * — a server component has no callback to hand it, and a column that is always
 * open has nothing to close.
 */
export function ShopFilterSidebar({
  brands,
  categories,
  settings,
  tags
}: Omit<ShopFilterPanelProps, "onClose" | "variant">) {
  return (
    <ShopFilterPanel
      brands={brands}
      categories={categories}
      settings={settings}
      tags={tags}
      variant="sidebar"
    />
  );
}

function FilterGroup({
  children,
  className,
  title
}: {
  children: ReactNode;
  className?: string | undefined;
  title: string;
}) {
  return (
    <section className={className ? `sf-filter-group ${className}` : "sf-filter-group"}>
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
  items: ShopFilterFacet[];
  onSelect: (slug: string | null) => void;
  title: string;
}) {
  return (
    /* Brands and tags are a set of choices rather than a list of rows, and the
       sidebar renders them as chips on that class. The drawer, which has the
       width for a list, ignores it. */
    <FilterGroup className="sf-filter-group-facets" title={title}>
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
