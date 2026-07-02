"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, type ReactNode, useEffect, useState } from "react";

export type TabbedProductTabsItem = {
  label: string;
  panelId: string;
};

type TabbedProductTabsProps = {
  arrowsVisible: boolean;
  children: ReactNode;
  defaultActiveTab: number;
  scrollAmount: "one" | "page";
  sectionId: string;
  sliderEnabled: boolean;
  tabs: TabbedProductTabsItem[];
};

export function TabbedProductTabs({
  arrowsVisible,
  children,
  defaultActiveTab,
  scrollAmount,
  sectionId,
  sliderEnabled,
  tabs
}: TabbedProductTabsProps) {
  const [activeIndex, setActiveIndex] = useState(Math.min(defaultActiveTab, Math.max(tabs.length - 1, 0)));
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const childArray = Children.toArray(children);
  const activePanelId = tabs[activeIndex]?.panelId;

  useEffect(() => {
    if (!activePanelId) {
      return;
    }

    const target = document.getElementById(activePanelId);

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
  }, [activePanelId]);

  const scroll = (direction: "left" | "right") => {
    if (!activePanelId) {
      return;
    }

    const target = document.getElementById(activePanelId);

    if (!target) {
      return;
    }

    const productWidth = target.querySelector<HTMLElement>(".general-product-listing-card")?.offsetWidth ?? target.clientWidth;
    const distance = scrollAmount === "one" ? productWidth : target.clientWidth * 0.9;

    target.scrollBy({
      behavior: "smooth",
      left: direction === "left" ? -distance : distance
    });
  };

  return (
    <>
      <div className="tabbed-product-showcase-controls">
        <div className="tabbed-product-showcase-tabs" role="tablist" aria-label="Product filters">
          {tabs.map((tab, index) => (
            <button
              aria-controls={tab.panelId}
              aria-selected={activeIndex === index}
              id={`${sectionId}-tab-${index}`}
              key={`${tab.label}-${index}`}
              onClick={() => setActiveIndex(index)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        {sliderEnabled && arrowsVisible ? (
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
        ) : null}
      </div>
      <div className="tabbed-product-showcase-panels">
        {childArray.map((child, index) => (
          <div
            aria-labelledby={`${sectionId}-tab-${index}`}
            className={`tabbed-product-showcase-panel${activeIndex === index ? " is-active" : ""}`}
            hidden={activeIndex !== index}
            key={tabs[index]?.panelId ?? index}
            role="tabpanel"
          >
            {child}
          </div>
        ))}
      </div>
    </>
  );
}
