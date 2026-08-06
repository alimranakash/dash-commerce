"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { StorefrontImage } from "../../components/storefront-image";
import type { StorefrontProductPageSettings } from "../../customization";

type GeneralProductGalleryProps = {
  images: Array<{
    alt: string;
    id: string;
    url: string;
  }>;
  settings: StorefrontProductPageSettings;
  title: string;
};

type GalleryImage = {
  alt: string;
  id: string;
  url: string;
};

export function GeneralProductGallery({ images: productImages, settings, title }: GeneralProductGalleryProps) {
  const images = useMemo(
    () => productImages.slice(0, 4).map((image) => ({
      alt: image.alt || title,
      id: image.id,
      url: image.url
    })),
    [productImages, title]
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [variantImageUrl, setVariantImageUrl] = useState("");
  const canOpenLightbox = settings.lightboxEnabled && images.length > 0;
  const displayImages = useMemo(() => (
    variantImageUrl
      ? [{ alt: title, id: "selected-variant-image", url: variantImageUrl }, ...images.filter((image) => image.url !== variantImageUrl)].slice(0, 4)
      : images
  ), [images, title, variantImageUrl]);

  useEffect(() => {
    if (lightboxIndex === null) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxIndex(null);
      }

      if (event.key === "ArrowRight") {
        setLightboxIndex((current) => current === null ? current : (current + 1) % displayImages.length);
      }

      if (event.key === "ArrowLeft") {
        setLightboxIndex((current) => current === null ? current : (current - 1 + displayImages.length) % displayImages.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxIndex, displayImages.length]);

  useEffect(() => {
    function onVariantMedia(event: Event) {
      const imageUrl = event instanceof CustomEvent ? String(event.detail?.imageUrl ?? "") : "";

      setVariantImageUrl(imageUrl);
      setActiveIndex(0);
    }

    window.addEventListener("dash:storefront-variant-media", onVariantMedia);

    return () => window.removeEventListener("dash:storefront-variant-media", onVariantMedia);
  }, []);

  const fallbackImage: GalleryImage = { alt: title, id: "fallback", url: "" };
  const visibleImages: GalleryImage[] = displayImages.length > 0 ? displayImages : [fallbackImage];
  const activeImage = visibleImages[activeIndex] ?? fallbackImage;

  return (
    <>
      <section
        aria-label={`${title} product media`}
        className={[
          "general-product-gallery",
          `general-product-gallery-${settings.galleryLayout}`,
          `general-product-gallery-${settings.imageRatio}`,
          settings.zoomEnabled ? "is-zoomable" : ""
        ].join(" ")}
        style={{ "--product-gallery-gap": `${settings.gallerySpacing}px` } as CSSProperties}
      >
        <button
          aria-label={activeImage.url ? `Open ${title} image ${activeIndex + 1}` : `${title} image placeholder`}
          className="general-product-gallery-item general-product-gallery-main"
          disabled={!canOpenLightbox || !activeImage.url}
          onClick={() => activeImage.url && setLightboxIndex(activeIndex)}
          type="button"
        >
          {activeImage.url ? (
            <StorefrontImage alt={activeImage.alt} fallback={title} loading="eager" src={activeImage.url} />
          ) : (
            <span>{title}</span>
          )}
        </button>
        {visibleImages.length > 1 ? (
          <div className="general-product-gallery-thumbs" aria-label={`${title} thumbnails`}>
            {visibleImages.map((image, index) => (
              <button
                aria-label={`Show ${title} image ${index + 1}`}
                aria-pressed={activeIndex === index}
                className={activeIndex === index ? "is-active" : ""}
                disabled={!image.url}
                key={image.id}
                onClick={() => setActiveIndex(index)}
                type="button"
              >
                {image.url ? <StorefrontImage alt="" fallback={String(index + 1)} src={image.url} /> : <span>{index + 1}</span>}
              </button>
            ))}
          </div>
        ) : null}
      </section>

      {lightboxIndex !== null && displayImages[lightboxIndex] ? (
        <div className="general-product-lightbox" role="dialog" aria-modal="true" aria-label={`${title} image preview`}>
          <button aria-label="Close image preview" className="general-product-lightbox-close" onClick={() => setLightboxIndex(null)} type="button">
            <X className="h-5 w-5" />
          </button>
          <button
            aria-label="Previous image"
            className="general-product-lightbox-nav previous"
            onClick={() => setLightboxIndex((lightboxIndex - 1 + displayImages.length) % displayImages.length)}
            type="button"
          >
            &lsaquo;
          </button>
          <img alt={displayImages[lightboxIndex].alt} src={displayImages[lightboxIndex].url} />
          <button
            aria-label="Next image"
            className="general-product-lightbox-nav next"
            onClick={() => setLightboxIndex((lightboxIndex + 1) % displayImages.length)}
            type="button"
          >
            &rsaquo;
          </button>
        </div>
      ) : null}
    </>
  );
}
