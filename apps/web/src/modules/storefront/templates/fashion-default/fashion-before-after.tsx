"use client";

import { useStorefrontBasePath } from "../../base-path-provider";
import Link from "next/link";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef, useState } from "react";
import { formatStorefrontMoney } from "../../format";
import type { FashionProductCardData } from "./fashion-product-card-data";
import styles from "./fashion-before-after.module.css";

// The handle stops short of both edges so it never sits half outside the frame,
// and so a fully dragged wipe still hints that a second photograph exists.
const MIN_POSITION = 4;
const MAX_POSITION = 96;
const KEYBOARD_STEP = 2;
const KEYBOARD_PAGE_STEP = 10;

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
  product
}: FashionBeforeAfterProps) {
  const basePath = useStorefrontBasePath();
  const frameRef = useRef<HTMLElement | null>(null);
  const [position, setPosition] = useState(clampPosition(initialPosition ?? 50));
  const [isDragging, setIsDragging] = useState(false);

  const moveToClientX = useCallback((clientX: number) => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const bounds = frame.getBoundingClientRect();

    if (bounds.width === 0) {
      return;
    }

    setPosition(clampPosition(((clientX - bounds.left) / bounds.width) * 100));
  }, []);

  const sectionStyle = {
    "--comparison-position": `${position}%`
  } as CSSProperties;
  const productHref = product?.slug
    ? `${basePath}/products/${product.slug}`
    : `${basePath}/products`;

  const handlePointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    // The product card is a real link sitting on top of the image, so a press
    // that lands on it must stay a navigation rather than becoming a wipe drag.
    if (event.target instanceof Element && event.target.closest(`.${styles.productCallout}`)) {
      return;
    }

    // Capture on the frame rather than the knob so a drag that starts anywhere
    // on the image keeps tracking even once the pointer leaves the section.
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    moveToClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!isDragging) {
      return;
    }

    moveToClientX(event.clientX);
  };

  const endDrag = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
  };

  return (
    <section
      aria-label="Before and after comparison"
      className={styles.section}
      data-dragging={isDragging ? "true" : undefined}
      onPointerCancel={endDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      ref={frameRef}
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

      <div className={styles.divider} aria-hidden="true" />
      <button
        aria-label="Drag to compare the two looks"
        aria-orientation="horizontal"
        aria-valuemax={MAX_POSITION}
        aria-valuemin={MIN_POSITION}
        aria-valuenow={Math.round(position)}
        className={styles.handle}
        onKeyDown={(event) => {
          const delta = keyboardDelta(event.key);

          if (delta === null) {
            return;
          }

          event.preventDefault();
          setPosition((current) => clampPosition(current + delta));
        }}
        role="slider"
        type="button"
      >
        <GripIcon />
      </button>

      {product ? (
        <Link className={styles.productCallout} href={productHref}>
          <div className={styles.thumbnail}>
            {product.images[0]?.url ? (
              <img
                alt={product.images[0].alt ?? product.title}
                decoding="async"
                draggable={false}
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
            <strong>{formatStorefrontMoney(product.price, currency)}</strong>
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
    <img
      alt=""
      className={className}
      decoding="async"
      draggable={false}
      loading="lazy"
      src={imageUrl}
    />
  ) : (
    <div className={`${className} ${fallbackClassName}`} aria-hidden="true" />
  );
}

function GripIcon() {
  return (
    <svg
      aria-hidden="true"
      className={styles.grip}
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M10.5 7.5 6.5 12l4 4.5M13.5 7.5 17.5 12l-4 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

// Home / End jump to the extremes so a keyboard user can see either photograph
// in full without holding an arrow key down.
function keyboardDelta(key: string) {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
      return -KEYBOARD_STEP;
    case "ArrowRight":
    case "ArrowUp":
      return KEYBOARD_STEP;
    case "PageDown":
      return -KEYBOARD_PAGE_STEP;
    case "PageUp":
      return KEYBOARD_PAGE_STEP;
    case "Home":
      return -100;
    case "End":
      return 100;
    default:
      return null;
  }
}

function clampPosition(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(MAX_POSITION, Math.max(MIN_POSITION, value));
}
