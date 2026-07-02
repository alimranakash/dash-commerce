"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

type ProductSectionSliderControlsProps = {
  targetId: string;
};

export function ProductSectionSliderControls({ targetId }: ProductSectionSliderControlsProps) {
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    const update = () => {
      const hasOverflow = target.scrollWidth > target.clientWidth + 1;
      setCanScrollLeft(hasOverflow && target.scrollLeft > 0);
      setCanScrollRight(hasOverflow && target.scrollLeft + target.clientWidth < target.scrollWidth - 1);
    };

    update();
    target.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      target.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [targetId]);

  const scroll = (direction: "left" | "right") => {
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    target.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -target.clientWidth * 0.85 : target.clientWidth * 0.85
    });
  };

  return (
    <div className="general-product-slider-controls" aria-label="Product slider controls">
      <span aria-hidden="true" />
      <button
        aria-label="Scroll products left"
        disabled={!canScrollLeft}
        onClick={() => scroll("left")}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        aria-label="Scroll products right"
        disabled={!canScrollRight}
        onClick={() => scroll("right")}
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
