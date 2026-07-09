"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useState } from "react";
import type { FashionProductCardData } from "./fashion-product-card-data";
import styles from "./fashion-before-after.module.css";

type FashionBeforeAfterProps = {
  afterImageUrl?: string | null | undefined;
  afterLabel?: string | null | undefined;
  beforeImageUrl?: string | null | undefined;
  beforeLabel?: string | null | undefined;
  currency: string;
  initialPosition?: number | null | undefined;
  product?: FashionProductCardData | null | undefined;
  storeSlug: string;
};

export function FashionBeforeAfter({
  afterImageUrl,
  afterLabel,
  beforeImageUrl,
  beforeLabel,
  currency,
  initialPosition,
  product,
  storeSlug
}: FashionBeforeAfterProps) {
  const [position, setPosition] = useState(
    Math.min(90, Math.max(10, initialPosition ?? 50))
  );
  const sectionStyle = {
    "--comparison-position": `${position}%`
  } as CSSProperties;
  const productHref = product?.slug
    ? `/s/${storeSlug}/products/${product.slug}`
    : `/s/${storeSlug}/products`;

  return (
    <section
      aria-label="Before and after comparison"
      className={styles.section}
      style={sectionStyle}
    >
      <ComparisonMedia
        className={styles.afterMedia}
        fallbackClassName={styles.afterFallback}
        imageUrl={afterImageUrl}
      />
      <div className={styles.beforeLayer}>
        <ComparisonMedia
          className={styles.beforeMedia}
          fallbackClassName={styles.beforeFallback}
          imageUrl={beforeImageUrl}
        />
      </div>

      <span className={`${styles.label} ${styles.beforeLabel}`}>
        {beforeLabel?.trim() || "Before"}
      </span>
      <span className={`${styles.label} ${styles.afterLabel}`}>
        {afterLabel?.trim() || "After"}
      </span>

      <input
        aria-label="Adjust before and after comparison"
        className={styles.range}
        max="90"
        min="10"
        onChange={(event) => setPosition(Number(event.target.value))}
        type="range"
        value={position}
      />
      <div className={styles.divider} aria-hidden="true">
        <span>
          <i>{"<"}</i>
          <i>{">"}</i>
        </span>
      </div>

      {product ? (
        <Link className={styles.productCallout} href={productHref}>
          <div className={styles.thumbnail}>
            {product.images[0]?.url ? (
              <img
                alt={product.images[0].alt ?? product.title}
                decoding="async"
                loading="lazy"
                src={product.images[0].url}
              />
            ) : (
              <span aria-hidden="true" />
            )}
          </div>
          <div>
            {product.category ? <p>{product.category.name}</p> : null}
            <h2>{product.title}</h2>
            <strong>{formatMoney(product.price, currency)}</strong>
          </div>
        </Link>
      ) : null}
    </section>
  );
}

function ComparisonMedia({
  className,
  fallbackClassName,
  imageUrl
}: {
  className: string | undefined;
  fallbackClassName: string | undefined;
  imageUrl?: string | null | undefined;
}) {
  return imageUrl ? (
    <img alt="" className={className} decoding="async" loading="lazy" src={imageUrl} />
  ) : (
    <div className={`${className} ${fallbackClassName}`} aria-hidden="true" />
  );
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
