"use client";

import { useStorefrontBasePath } from "../../base-path-provider";
import Link from "next/link";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useRef, useState } from "react";
import {
  DEFAULT_STOREFRONT_ADVANCED_SETTINGS,
  type StorefrontAdvancedSettings
} from "../../customization";
import { formatStorefrontMoney } from "../../format";
import type { BeautyComparisonProduct } from "./beauty-comparison-product";

const SECTION_ID = "beauty-before-after";
// The handle stops short of both edges so it never sits half outside the rounded
// frame, and so a fully dragged slider still hints that a second image exists.
const MIN_POSITION = 4;
const MAX_POSITION = 96;
const KEYBOARD_STEP = 2;
const KEYBOARD_PAGE_STEP = 10;

export type BeautyBeforeAfterSectionProps = {
  advancedSettings?: StorefrontAdvancedSettings | null | undefined;
  currency: string;
  product?: BeautyComparisonProduct | null | undefined;
  storeSlug: string;
};

export function BeautyBeforeAfterSection({
  advancedSettings,
  currency,
  product,
}: BeautyBeforeAfterSectionProps) {
  const basePath = useStorefrontBasePath();
  const beauty = advancedSettings?.beauty ?? DEFAULT_STOREFRONT_ADVANCED_SETTINGS.beauty;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState(clamp(beauty.comparisonInitialPosition));
  const [isDragging, setIsDragging] = useState(false);

  // Both photographs are required: with only one there is nothing to compare, and
  // a lone image under this heading would read as a broken section.
  const beforeImageUrl = beauty.comparisonBeforeImageUrl.trim();
  const afterImageUrl = beauty.comparisonAfterImageUrl.trim();

  const moveToClientX = useCallback((clientX: number) => {
    const frame = frameRef.current;

    if (!frame) {
      return;
    }

    const bounds = frame.getBoundingClientRect();

    if (bounds.width === 0) {
      return;
    }

    const ratio = ((clientX - bounds.left) / bounds.width) * 100;

    setPosition(clamp(ratio));
  }, []);

  if (!beforeImageUrl || !afterImageUrl) {
    return null;
  }

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    // The product card and the shop button are real links sitting on top of the
    // image, so a press that lands on either must stay a navigation rather than
    // becoming a wipe drag.
    if (event.target instanceof Element && event.target.closest("[data-comparison-link]")) {
      return;
    }

    // Capture on the frame rather than the knob so a drag that starts anywhere on
    // the image keeps tracking even once the pointer leaves the frame.
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    moveToClientX(event.clientX);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isDragging) {
      return;
    }

    moveToClientX(event.clientX);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setIsDragging(false);
  };

  const sectionStyle = {
    ...(beauty.comparisonAccentColor
      ? { "--beauty-comparison-accent": beauty.comparisonAccentColor }
      : {}),
    "--beauty-comparison-position": `${position}%`
  } as CSSProperties;
  const productHref = product?.slug
    ? `${basePath}/products/${product.slug}`
    : `${basePath}/products`;

  return (
    <section
      aria-labelledby={beauty.comparisonTitle ? `${SECTION_ID}-title` : undefined}
      className="beauty-home-section beauty-before-after"
      id={SECTION_ID}
      style={sectionStyle}
    >
      {beauty.comparisonTitle ? (
        <h2 className="beauty-before-after-heading" id={`${SECTION_ID}-title`}>
          {beauty.comparisonTitle}
        </h2>
      ) : null}
      <div
        className="beauty-before-after-frame"
        data-dragging={isDragging ? "true" : undefined}
        onPointerCancel={endDrag}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        ref={frameRef}
      >
        <img
          alt="After using the products"
          className="beauty-before-after-image"
          decoding="async"
          draggable={false}
          loading="lazy"
          src={afterImageUrl}
        />
        <div className="beauty-before-after-clip">
          <img
            alt="Before using the products"
            className="beauty-before-after-image"
            decoding="async"
            draggable={false}
            loading="lazy"
            src={beforeImageUrl}
          />
        </div>

        <span className="beauty-before-after-label beauty-before-after-label-before">
          {beauty.comparisonBeforeLabel}
        </span>
        <span className="beauty-before-after-label beauty-before-after-label-after">
          {beauty.comparisonAfterLabel}
        </span>

        <span aria-hidden="true" className="beauty-before-after-divider" />
        <button
          aria-label="Drag to compare the before and after photos"
          aria-orientation="horizontal"
          aria-valuemax={MAX_POSITION}
          aria-valuemin={MIN_POSITION}
          aria-valuenow={Math.round(position)}
          className="beauty-before-after-handle"
          onKeyDown={(event) => {
            const delta = keyboardDelta(event.key);

            if (delta === null) {
              return;
            }

            event.preventDefault();
            setPosition((current) => clamp(current + delta));
          }}
          role="slider"
          type="button"
        >
          <GripIcon />
        </button>

        {beauty.comparisonCtaText ? (
          <Link
            aria-label={beauty.comparisonCtaText}
            className="beauty-before-after-cta"
            data-comparison-link=""
            href={storefrontHref(basePath, beauty.comparisonCtaLink)}
            title={beauty.comparisonCtaText}
          >
            <ArrowIcon />
          </Link>
        ) : null}

        {product ? (
          <Link className="beauty-before-after-product" data-comparison-link="" href={productHref}>
            <span className="beauty-before-after-thumb">
              {product.imageUrl ? (
                <img
                  alt={product.imageAlt ?? product.title}
                  decoding="async"
                  draggable={false}
                  loading="lazy"
                  src={product.imageUrl}
                />
              ) : null}
            </span>
            <span className="beauty-before-after-product-copy">
              {product.categoryName ? <span>{product.categoryName}</span> : null}
              <strong>{product.title}</strong>
              <em>{formatStorefrontMoney(product.price, currency)}</em>
            </span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="beauty-before-after-arrow"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M5 12h13.5M13 6.5 18.5 12 13 17.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function GripIcon() {
  return (
    <svg
      aria-hidden="true"
      className="beauty-before-after-grip"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <path
        d="M10 8.5 6.5 12 10 15.5M14 8.5 17.5 12 14 15.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

// Home / End jump to the extremes so a keyboard user can see either photograph in
// full without holding an arrow key down.
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

function clamp(value: number) {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(MAX_POSITION, Math.max(MIN_POSITION, value));
}

// Seller-entered links are store-relative paths; absolute URLs are left alone.
function storefrontHref(basePath: string, link: string) {
  if (/^https?:\/\//.test(link)) {
    return link;
  }

  return `${basePath}${link.startsWith("/") ? link : `/${link}`}`;
}
