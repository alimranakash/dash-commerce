"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ProductPrice } from "../../components/product-card";
import { StorefrontImage } from "../../components/storefront-image";

export type ElectronicsRecommendedCategory = {
  id: string;
  name: string;
  slug: string;
};

export type ElectronicsRecommendedProduct = {
  category: ElectronicsRecommendedCategory | null;
  compareAtPrice: string | null;
  id: string;
  image: {
    alt: string | null;
    url: string;
  } | null;
  price: string;
  slug: string;
  title: string;
};

type ElectronicsRecommendedForYouClientProps = {
  categories: ElectronicsRecommendedCategory[];
  currency: string;
  products: ElectronicsRecommendedProduct[];
  storeSlug: string;
  title?: string | undefined;
};

const ALL_CATEGORY = "all";

export function ElectronicsRecommendedForYouClient({
  categories,
  currency,
  products,
  storeSlug,
  title
}: ElectronicsRecommendedForYouClientProps) {
  const [activeCategory, setActiveCategory] = useState(ALL_CATEGORY);
  const tabListRef = useRef<HTMLDivElement>(null);
  const visibleProducts = products
    .filter((product) => activeCategory === ALL_CATEGORY || product.category?.id === activeCategory)
    .slice(0, 12);

  function selectCategory(categoryId: string, button: HTMLButtonElement) {
    setActiveCategory(categoryId);
    button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }

  function handleTabKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
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
    <section className="electronics-recommended" aria-labelledby="electronics-recommended-title">
      <div className="electronics-recommended-inner">
        <h2 id="electronics-recommended-title">{title || "Recommended for You"}</h2>
        <div
          aria-label="Recommended product categories"
          className="electronics-recommended-tabs"
          ref={tabListRef}
          role="tablist"
        >
          {tabs.map((tab, index) => {
            const isActive = activeCategory === tab.id;

            return (
              <button
                aria-controls="electronics-recommended-products"
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
          className="electronics-recommended-panel"
          id="electronics-recommended-products"
          key={activeCategory}
          role="tabpanel"
        >
          {visibleProducts.length > 0 ? (
            <div className="electronics-recommended-grid">
              {visibleProducts.map((product) => (
                <ElectronicsRecommendedProductCard
                  currency={currency}
                  key={product.id}
                  product={product}
                  storeSlug={storeSlug}
                />
              ))}
            </div>
          ) : (
            <div className="electronics-recommended-empty">
              <strong>No products in this category yet.</strong>
              <span>Choose another category to keep browsing.</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ElectronicsRecommendedProductCard({
  currency,
  product,
  storeSlug
}: {
  currency: string;
  product: ElectronicsRecommendedProduct;
  storeSlug: string;
}) {
  return (
    <Link className="electronics-recommended-card" href={`/s/${storeSlug}/products/${product.slug}`}>
      <span className="electronics-recommended-media">
        <StorefrontImage
          alt={product.image?.alt ?? product.title}
          fallback={product.category?.name.slice(0, 2).toUpperCase() ?? "TX"}
          src={product.image?.url}
        />
      </span>
      <span className="electronics-recommended-info">
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
