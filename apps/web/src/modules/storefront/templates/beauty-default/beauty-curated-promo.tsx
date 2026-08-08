"use client";

import Link from "next/link";
import { useState } from "react";

export type BeautyCuratedPromoProps = {
  ctaHref: string;
  ctaText: string;
  eyebrow: string;
  // Empty means no photography is configured yet; the card then falls back to its
  // own blush gradient rather than rendering a broken image.
  images: string[];
  title: string;
};

export function BeautyCuratedPromo({ ctaHref, ctaText, eyebrow, images, title }: BeautyCuratedPromoProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[Math.min(activeIndex, images.length - 1)];

  return (
    <aside className="beauty-curated-promo">
      {activeImage ? (
        <img alt="" className="beauty-curated-promo-image" loading="lazy" src={activeImage} />
      ) : null}
      <div className="beauty-curated-promo-body">
        {eyebrow ? <p className="beauty-curated-promo-eyebrow">{eyebrow}</p> : null}
        {title ? <h3 className="beauty-curated-promo-title">{title}</h3> : null}
      </div>
      <div className="beauty-curated-promo-footer">
        {ctaText ? (
          <Link className="beauty-curated-promo-cta" href={ctaHref}>
            {ctaText}
          </Link>
        ) : null}
        {images.length > 1 ? (
          <div className="beauty-curated-promo-dots">
            {images.map((image, index) => (
              <button
                aria-label={`Show promo image ${index + 1}`}
                aria-pressed={index === activeIndex}
                className={index === activeIndex ? "is-active" : undefined}
                key={`${image}-${index}`}
                onClick={() => setActiveIndex(index)}
                type="button"
              />
            ))}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
