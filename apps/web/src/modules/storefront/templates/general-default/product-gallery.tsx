"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { StorefrontProductPageSettings } from "../../customization";
import type { StorefrontProductDetails } from "../../storefront.types";

type GeneralProductGalleryProps = {
  product: StorefrontProductDetails;
  settings: StorefrontProductPageSettings;
};

export function GeneralProductGallery({ product, settings }: GeneralProductGalleryProps) {
  const images = useMemo(
    () => product.images.map((image) => ({
      alt: image.alt ?? product.title,
      id: image.id,
      url: image.url
    })),
    [product.images, product.title]
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const canOpenLightbox = settings.lightboxEnabled && images.length > 0;

  useEffect(() => {
    if (activeIndex === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveIndex(null);
      }

      if (event.key === "ArrowRight") {
        setActiveIndex((current) => current === null ? current : (current + 1) % images.length);
      }

      if (event.key === "ArrowLeft") {
        setActiveIndex((current) => current === null ? current : (current - 1 + images.length) % images.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, images.length]);

  const visibleImages = images.length > 0 ? images : [{ alt: product.title, id: "fallback", url: "" }];

  return (
    <>
      <section
        aria-label={`${product.title} product media`}
        className={[
          "general-product-gallery",
          `general-product-gallery-${settings.galleryLayout}`,
          `general-product-gallery-${settings.imageRatio}`,
          settings.zoomEnabled ? "is-zoomable" : ""
        ].join(" ")}
        style={{ "--product-gallery-gap": `${settings.gallerySpacing}px` } as CSSProperties}
      >
        {visibleImages.map((image, index) => (
          <button
            aria-label={`Open ${product.title} image ${index + 1}`}
            className="general-product-gallery-item"
            disabled={!canOpenLightbox || !image.url}
            key={image.id}
            onClick={() => image.url && setActiveIndex(index)}
            type="button"
          >
            {image.url ? <img alt={image.alt} loading={index < 2 ? "eager" : "lazy"} src={image.url} /> : <span>{product.title}</span>}
          </button>
        ))}
      </section>

      {activeIndex !== null && images[activeIndex] ? (
        <div className="general-product-lightbox" role="dialog" aria-modal="true" aria-label={`${product.title} image preview`}>
          <button aria-label="Close image preview" className="general-product-lightbox-close" onClick={() => setActiveIndex(null)} type="button">
            <X className="h-5 w-5" />
          </button>
          <button
            aria-label="Previous image"
            className="general-product-lightbox-nav previous"
            onClick={() => setActiveIndex((activeIndex - 1 + images.length) % images.length)}
            type="button"
          >
            &lsaquo;
          </button>
          <img alt={images[activeIndex].alt} src={images[activeIndex].url} />
          <button
            aria-label="Next image"
            className="general-product-lightbox-nav next"
            onClick={() => setActiveIndex((activeIndex + 1) % images.length)}
            type="button"
          >
            &rsaquo;
          </button>
        </div>
      ) : null}
    </>
  );
}
