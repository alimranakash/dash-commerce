"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type ProductSectionSliderControlsProps = {
  targetId: string;
};

export function ProductSectionSliderControls({ targetId }: ProductSectionSliderControlsProps) {
  const targetRef = useRef<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    targetRef.current = target;

    if (!target) {
      return;
    }

    const update = () => {
      const maxScroll = target.scrollWidth - target.clientWidth;
      const hasOverflow = maxScroll > 1;
      setCanScrollLeft(hasOverflow && target.scrollLeft > 1);
      setCanScrollRight(hasOverflow && target.scrollLeft < maxScroll - 1);
    };

    update();
    target.addEventListener("scroll", update, { passive: true });

    // The row can change size without a window resize (image/font settling,
    // container queries, a hidden panel becoming visible), so observe it too.
    const observer = new ResizeObserver(update);
    observer.observe(target);

    const firstCard = target.firstElementChild;

    if (firstCard) {
      observer.observe(firstCard);
    }

    return () => {
      target.removeEventListener("scroll", update);
      observer.disconnect();
      targetRef.current = null;
    };
  }, [targetId]);

  const scroll = (direction: -1 | 1) => {
    const target = targetRef.current ?? document.getElementById(targetId);

    if (!target) {
      return;
    }

    target.scrollBy({
      behavior: "smooth",
      left: direction * scrollStep(target)
    });
  };

  return (
    <div className="general-product-slider-controls" aria-label="Product slider controls">
      <span aria-hidden="true" />
      <button
        aria-label="Scroll products left"
        disabled={!canScrollLeft}
        onClick={() => scroll(-1)}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        aria-label="Scroll products right"
        disabled={!canScrollRight}
        onClick={() => scroll(1)}
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// One step is a full viewport rounded down to whole cards, so the row always
// lands on a card boundary instead of halfway through one.
function scrollStep(target: HTMLElement) {
  const card = target.firstElementChild;
  const cardWidth = card ? card.getBoundingClientRect().width : 0;

  if (cardWidth <= 0) {
    return target.clientWidth * 0.85;
  }

  const gap = Number.parseFloat(window.getComputedStyle(target).columnGap) || 0;
  const stride = cardWidth + gap;
  const perView = Math.max(1, Math.floor((target.clientWidth + gap) / stride));

  return stride * perView;
}
