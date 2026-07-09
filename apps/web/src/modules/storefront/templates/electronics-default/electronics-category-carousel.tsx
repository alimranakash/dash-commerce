"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { StorefrontImage } from "../../components/storefront-image";
import styles from "./electronics-category-carousel.module.css";

export type ElectronicsCarouselItem = {
  fallback: string;
  href: string;
  imageUrl?: string | null;
  label: string;
};

type ElectronicsCategoryCarouselProps = {
  items: ElectronicsCarouselItem[];
};

export function ElectronicsCategoryCarousel({ items }: ElectronicsCategoryCarouselProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollNext, setCanScrollNext] = useState(false);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const viewportElement = viewport;

    function updateScrollState() {
      setCanScrollNext(viewportElement.scrollLeft + viewportElement.clientWidth < viewportElement.scrollWidth - 4);
    }

    updateScrollState();
    viewportElement.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);

    return () => {
      viewportElement.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [items.length]);

  function scrollNext() {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollBy({
      behavior: "smooth",
      left: viewport.clientWidth * 0.72
    });
  }

  return (
    <div className={styles.shell}>
      <div className={styles.viewport} ref={viewportRef}>
        {items.map((item) => (
          <Link className={styles.card} href={item.href} key={`${item.label}-${item.href}`}>
            <span className={styles.image}>
              <StorefrontImage alt="" fallback={item.fallback} src={item.imageUrl} />
            </span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        ))}
      </div>
      <button
        aria-label="Show more categories"
        className={styles.arrow}
        disabled={!canScrollNext}
        onClick={scrollNext}
        type="button"
      >
        <ArrowRight size={27} strokeWidth={2.2} />
      </button>
    </div>
  );
}
