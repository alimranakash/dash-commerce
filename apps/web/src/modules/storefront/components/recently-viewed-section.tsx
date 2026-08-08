"use client";

import { useEffect, useState } from "react";
import type { StorefrontProductSectionSettings } from "../customization";
import { ProductGrid, SectionHeader, type ProductCardProduct } from "./product-listing";
import { storefrontSectionHref } from "../product-sections";

// A snapshot is stored per product view so the rail can render without another
// round trip, and keeps working for products that later leave the catalogue.
export type RecentlyViewedProduct = {
  compareAtPrice: string | null;
  createdAt: string;
  hoverImageUrl: string | null;
  id: string;
  imageUrl: string | null;
  price: string;
  slug: string;
  stockQuantity: number;
  title: string;
};

type RecentlyViewedSectionProps = {
  cardVariant?: string | undefined;
  currency: string;
  currentProduct: RecentlyViewedProduct;
  section: StorefrontProductSectionSettings;
  storeId?: string | undefined;
  storeSlug: string;
};

const MAX_STORED_PRODUCTS = 24;

export function RecentlyViewedSection({
  cardVariant,
  currency,
  currentProduct,
  section,
  storeId,
  storeSlug
}: RecentlyViewedSectionProps) {
  const [products, setProducts] = useState<RecentlyViewedProduct[]>([]);

  useEffect(() => {
    const storageKey = `dash:recently-viewed:${storeSlug}`;
    const stored = readStoredProducts(storageKey);

    // The current product only becomes part of the rail on the next visit, so
    // the row never repeats the product the shopper is already looking at.
    setProducts(stored.filter((item) => item.id !== currentProduct.id));

    const next = [currentProduct, ...stored.filter((item) => item.id !== currentProduct.id)].slice(
      0,
      MAX_STORED_PRODUCTS
    );

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // Private browsing or a full quota just means no history is kept.
    }
  }, [currentProduct, storeSlug]);

  if (products.length === 0) {
    return null;
  }

  const gridId = "storefront-recently-viewed-grid";

  return (
    <section className="general-home-section general-product-section" aria-labelledby="recently-viewed-title">
      <SectionHeader
        ctaHref={storefrontSectionHref(storeSlug, section.ctaLink)}
        ctaText={section.ctaText}
        id="recently-viewed-title"
        sliderTargetId={section.mode === "slider" ? gridId : undefined}
        subtitle={section.subtitle}
        title={section.title}
      />
      <ProductGrid
        cardVariant={cardVariant}
        currency={currency}
        gridId={gridId}
        products={products.slice(0, section.count).map(toProductCardProduct)}
        section={section}
        storeId={storeId}
        storeSlug={storeSlug}
      />
    </section>
  );
}

function readStoredProducts(storageKey: string): RecentlyViewedProduct[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    const parsed: unknown = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed.filter(isRecentlyViewedProduct) : [];
  } catch {
    return [];
  }
}

function isRecentlyViewedProduct(value: unknown): value is RecentlyViewedProduct {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const product = value as Partial<RecentlyViewedProduct>;

  return typeof product.id === "string" && typeof product.slug === "string" && typeof product.title === "string";
}

function toProductCardProduct(product: RecentlyViewedProduct): ProductCardProduct {
  const images = [product.imageUrl, product.hoverImageUrl]
    .filter((url): url is string => Boolean(url))
    .map((url) => ({ alt: product.title, url }));

  return {
    compareAtPrice: product.compareAtPrice,
    createdAt: product.createdAt,
    id: product.id,
    images,
    price: product.price,
    slug: product.slug,
    stockQuantity: product.stockQuantity,
    title: product.title
  };
}
