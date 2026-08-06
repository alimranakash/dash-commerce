"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { ProductSectionSliderControls } from "./product-section-slider-controls";

export type TabbedProductTabsItem = {
  label: string;
  panelId: string;
};

type TabbedProductTabsProps = {
  arrowsVisible: boolean;
  autoplay: boolean;
  defaultActiveTab: number;
  infiniteLoop: boolean;
  // Panels arrive as a prop rather than as `children` on purpose. They are
  // server-rendered product rows, and taking them as a stable array lets React
  // skip re-rendering every card when a tab is clicked. Running them through
  // `Children.toArray` instead would clone and re-key each one on every render.
  panels: ReactNode[];
  scrollAmount: "one" | "page";
  sectionId: string;
  sliderEnabled: boolean;
  tabs: TabbedProductTabsItem[];
};

export function TabbedProductTabs({
  arrowsVisible,
  autoplay,
  defaultActiveTab,
  infiniteLoop,
  panels,
  scrollAmount,
  sectionId,
  sliderEnabled,
  tabs
}: TabbedProductTabsProps) {
  const [activeIndex, setActiveIndex] = useState(Math.min(defaultActiveTab, Math.max(tabs.length - 1, 0)));
  const activePanelId = tabs[activeIndex]?.panelId;

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
        {/* Autoplay and infinite loop live in the controls, so they mount
            whenever the slider is on - even with the arrows hidden. */}
        {sliderEnabled && activePanelId ? (
          <ProductSectionSliderControls
            autoplay={autoplay}
            infiniteLoop={infiniteLoop}
            key={activePanelId}
            scrollAmount={scrollAmount}
            showArrows={arrowsVisible}
            targetId={activePanelId}
          />
        ) : null}
      </div>
      <div className="tabbed-product-showcase-panels">
        {panels.map((panel, index) => (
          <div
            aria-labelledby={`${sectionId}-tab-${index}`}
            className={`tabbed-product-showcase-panel${activeIndex === index ? " is-active" : ""}`}
            hidden={activeIndex !== index}
            key={tabs[index]?.panelId ?? index}
            role="tabpanel"
          >
            {panel}
          </div>
        ))}
      </div>
    </>
  );
}
