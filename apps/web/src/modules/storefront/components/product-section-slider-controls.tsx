"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

type ProductSectionSliderControlsProps = {
  autoplay?: boolean;
  infiniteLoop?: boolean;
  scrollAmount?: "one" | "page";
  showArrows?: boolean;
  targetId: string;
};

// Autoplay has no seller-facing interval of its own, so it reuses one step of
// the configured scroll amount on a steady beat.
const AUTOPLAY_INTERVAL_MS = 4000;

export function ProductSectionSliderControls({
  autoplay = false,
  infiniteLoop = false,
  scrollAmount = "page",
  showArrows = true,
  targetId
}: ProductSectionSliderControlsProps) {
  const targetRef = useRef<HTMLElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    targetRef.current = target;

    if (!target) {
      return;
    }

    const update = () => {
      const maxScroll = target.scrollWidth - target.clientWidth;
      const overflowing = maxScroll > 1;
      setHasOverflow(overflowing);
      setCanScrollLeft(overflowing && target.scrollLeft > 1);
      setCanScrollRight(overflowing && target.scrollLeft < maxScroll - 1);
    };

    update();
    target.addEventListener("scroll", update, { passive: true });

    // The row can change size without a window resize (image/font settling,
    // container queries, a hidden tab panel becoming visible), so observe both
    // the row and its cards rather than relying on window resize alone.
    const observer = new ResizeObserver(update);
    observer.observe(target);

    for (const card of Array.from(target.children)) {
      observer.observe(card);
    }

    return () => {
      target.removeEventListener("scroll", update);
      observer.disconnect();
      targetRef.current = null;
    };
  }, [targetId]);

  const scroll = useCallback(
    (direction: -1 | 1) => {
      const target = targetRef.current ?? document.getElementById(targetId);

      if (!target) {
        return;
      }

      const maxScroll = target.scrollWidth - target.clientWidth;

      // Infinite loop wraps at the ends instead of stopping there, so autoplay
      // and the arrows both keep going in one direction forever.
      if (infiniteLoop && maxScroll > 1) {
        if (direction === 1 && target.scrollLeft >= maxScroll - 1) {
          target.scrollTo({ behavior: "smooth", left: 0 });
          return;
        }

        if (direction === -1 && target.scrollLeft <= 1) {
          target.scrollTo({ behavior: "smooth", left: maxScroll });
          return;
        }
      }

      target.scrollBy({
        behavior: "smooth",
        left: direction * scrollStep(target, scrollAmount)
      });
    },
    [infiniteLoop, scrollAmount, targetId]
  );

  useEffect(() => {
    if (!autoplay || !hasOverflow) {
      return;
    }

    const timer = window.setInterval(() => scroll(1), AUTOPLAY_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [autoplay, hasOverflow, scroll]);

  if (!showArrows) {
    return null;
  }

  return (
    <div className="general-product-slider-controls" aria-label="Product slider controls">
      <span aria-hidden="true" />
      <button
        aria-label="Scroll products left"
        disabled={!(infiniteLoop ? hasOverflow : canScrollLeft)}
        onClick={() => scroll(-1)}
        type="button"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        aria-label="Scroll products right"
        disabled={!(infiniteLoop ? hasOverflow : canScrollRight)}
        onClick={() => scroll(1)}
        type="button"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// A step is either a single card or a full viewport rounded down to whole
// cards, so the row always lands on a card boundary instead of halfway through.
function scrollStep(target: HTMLElement, scrollAmount: "one" | "page") {
  const card = target.firstElementChild;
  const cardWidth = card ? card.getBoundingClientRect().width : 0;

  if (cardWidth <= 0) {
    return target.clientWidth * 0.85;
  }

  const gap = Number.parseFloat(window.getComputedStyle(target).columnGap) || 0;
  const stride = cardWidth + gap;

  if (scrollAmount === "one") {
    return stride;
  }

  const perView = Math.max(1, Math.floor((target.clientWidth + gap) / stride));

  return stride * perView;
}
