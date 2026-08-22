"use client";

import { useStorefrontBasePath } from "../../base-path-provider";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FashionEditorialProductCard } from "./fashion-editorial-product-card";
import type { FashionProductCardData } from "./fashion-product-card-data";
import styles from "./fashion-new-arrivals.module.css";

type FashionNewArrivalsProps = {
  currency: string;
  description: string;
  products: FashionProductCardData[];
  storeSlug: string;
  title: string;
};

export function FashionNewArrivals({
  currency,
  description,
  products,
  storeSlug,
  title
}: FashionNewArrivalsProps) {
  const basePath = useStorefrontBasePath();
  const tabs = useMemo(() => {
    const unique = new Map<string, { label: string; slug: string }>();

    products.forEach((product) => {
      if (product.category && !unique.has(product.category.slug)) {
        unique.set(product.category.slug, {
          label: product.category.name,
          slug: product.category.slug
        });
      }
    });

    return Array.from(unique.values()).slice(0, 2);
  }, [products]);
  const [activeTab, setActiveTab] = useState<string | null>(tabs[0]?.slug ?? null);
  const visibleProducts = activeTab
    ? products.filter((product) => product.category?.slug === activeTab).slice(0, 4)
    : products.slice(0, 4);
  const activeCategory = tabs.find((tab) => tab.slug === activeTab);
  const shopHref = activeCategory
    ? `${basePath}/categories/${activeCategory.slug}`
    : `${basePath}/products`;

  return (
    <section className={styles.section} id="fashion-new-collection" aria-labelledby="fashion-new-arrivals-title">
      <header className={styles.header}>
        <div className={styles.intro}>
          <h2 id="fashion-new-arrivals-title">{title}</h2>
          <p>{description}</p>
          {tabs.length > 0 ? (
            <div className={styles.tabs} role="tablist" aria-label="New arrival categories">
              {tabs.map((tab, index) => (
                <button
                  aria-selected={activeTab === tab.slug}
                  className={activeTab === tab.slug ? styles.activeTab : undefined}
                  key={tab.slug}
                  onClick={() => setActiveTab(tab.slug)}
                  role="tab"
                  type="button"
                >
                  {tab.label}
                  {index < tabs.length - 1 ? <span aria-hidden="true">/</span> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <Link className={styles.shopLink} href={shopHref}>
          Shop {activeCategory?.label ?? "Collection"}
        </Link>
      </header>

      {products.length > 0 ? (
        <div className={styles.grid}>
          {visibleProducts.map((product) => (
            <FashionEditorialProductCard
              currency={currency}
              key={product.id}
              product={product}
              storeSlug={storeSlug}
            />
          ))}
        </div>
      ) : (
        <p className={styles.empty}>New arrivals will appear here when products are published.</p>
      )}
    </section>
  );
}
