"use client";

import Link from "next/link";
import { useRef, useState, type KeyboardEvent } from "react";
import { useStorefrontBasePath } from "../../base-path-provider";
import { ProductPrice } from "../../components/product-card";
import { ProductHoverImage } from "../../components/product-listing";
import { StorefrontImage } from "../../components/storefront-image";

export type GeneralRecommendedCategory = {
  id: string;
  name: string;
  slug: string;
};

export type GeneralRecommendedProduct = {
  category: GeneralRecommendedCategory | null;
  compareAtPrice: string | null;
  hoverImage: {
    alt: string | null;
    url: string;
  } | null;
  id: string;
  image: {
    alt: string | null;
    url: string;
  } | null;
  price: string;
  slug: string;
  title: string;
};

type GeneralRecommendedForYouClientProps = {
  categories: GeneralRecommendedCategory[];
  currency: string;
  products: GeneralRecommendedProduct[];
  title?: string | undefined;
};

const ALL_CATEGORY = "all";

/** Three full rows of the four-column grid. */
const VISIBLE_PRODUCT_LIMIT = 12;

/**
 * The closing band of the general homepage: one catalogue, filtered in place by
 * category rather than by navigating away.
 *
 * The tab row is a real `tablist` — arrow keys move between categories and the
 * panel announces itself — because the tabs are the only way to reach most of
 * what the section holds.
 */
export function GeneralRecommendedForYouClient({
  categories,
  currency,
  products,
  title
}: GeneralRecommendedForYouClientProps) {
  const basePath = useStorefrontBasePath();
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const tabListRef = useRef<HTMLDivElement>(null);
  const visibleProducts = products
    .filter((product) => activeCategory === ALL_CATEGORY || product.category?.id === activeCategory)
    .slice(0, VISIBLE_PRODUCT_LIMIT);

  function selectCategory(categoryId: string, button: HTMLButtonElement) {
    setActiveCategory(categoryId);
    button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const tabs = tabListRef.current?.querySelectorAll<HTMLButtonElement>("[role='tab']");

    if (!tabs?.length) {
      return;
    }

    const offset = event.key === "ArrowRight" ? 1 : -1;
    const nextTab = tabs[(index + offset + tabs.length) % tabs.length];
    nextTab?.focus();

    if (nextTab) {
      selectCategory(nextTab.dataset.categoryId ?? ALL_CATEGORY, nextTab);
    }
  }

  const tabs = [{ id: ALL_CATEGORY, name: "All" }, ...categories];

  return (
    <section aria-labelledby="general-recommended-title" className="general-recommended">
      <div className="general-section-heading">
        <div>
          <p>Just for you</p>
          <h2 id="general-recommended-title">{title || "Recommended for You"}</h2>
        </div>
        <Link href={`${basePath}/products`}>View all</Link>
      </div>

      <div
        aria-label="Recommended product categories"
        className="general-recommended-tabs"
        ref={tabListRef}
        role="tablist"
      >
        {tabs.map((tab, index) => {
          const isActive = activeCategory === tab.id;

          return (
            <button
              aria-controls="general-recommended-products"
              aria-selected={isActive}
              className={isActive ? "is-active" : undefined}
              data-category-id={tab.id}
              key={tab.id}
              onClick={(event) => selectCategory(tab.id, event.currentTarget)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              type="button"
            >
              {tab.name}
            </button>
          );
        })}
      </div>

      <div
        aria-live="polite"
        className="general-recommended-panel"
        id="general-recommended-products"
        key={activeCategory}
        role="tabpanel"
      >
        {visibleProducts.length > 0 ? (
          <div className="general-recommended-grid">
            {visibleProducts.map((product) => (
              <GeneralRecommendedCard currency={currency} key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="general-recommended-empty">
            <strong>No products in this category yet.</strong>
            <span>Choose another category to keep browsing.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function GeneralRecommendedCard({
  currency,
  product
}: {
  currency: string;
  product: GeneralRecommendedProduct;
}) {
  const basePath = useStorefrontBasePath();
  const imageFallback = product.category?.name.slice(0, 2).toUpperCase() ?? "SH";

  return (
    <Link className="general-recommended-card" href={`${basePath}/products/${product.slug}`}>
      <span className="general-recommended-media">
        <StorefrontImage
          alt={product.image?.alt ?? product.title}
          fallback={imageFallback}
          src={product.image?.url}
        />
        {product.hoverImage ? (
          <ProductHoverImage
            alt={product.hoverImage.alt ?? product.title}
            fallback={imageFallback}
            src={product.hoverImage.url}
          />
        ) : null}
      </span>
      <span className="general-recommended-info">
        <small>{product.category?.name ?? "Uncategorized"}</small>
        <strong>{product.title}</strong>
      </span>
      <ProductPrice
        compareAtPrice={product.compareAtPrice ?? undefined}
        currency={currency}
        price={product.price}
      />
    </Link>
  );
}
