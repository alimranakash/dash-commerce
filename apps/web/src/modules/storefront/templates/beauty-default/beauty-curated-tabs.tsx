"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export type BeautyCuratedTab = {
  label: string;
  panelId: string;
};

type BeautyCuratedTabsProps = {
  // Panels arrive as a prop, not as children: they are server-rendered product
  // grids, and a stable array lets React keep every card mounted when a tab is
  // clicked instead of re-creating the whole grid.
  panels: ReactNode[];
  sectionId: string;
  tabs: BeautyCuratedTab[];
  title: string;
  titleId: string;
};

export function BeautyCuratedTabs({ panels, sectionId, tabs, title, titleId }: BeautyCuratedTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="beauty-curated-main">
      <div className="beauty-curated-header">
        <h2 className="beauty-curated-title" id={titleId}>
          {title}
        </h2>
        {tabs.length > 1 ? (
          <div aria-label="Filter by category" className="beauty-curated-tablist" role="tablist">
            {tabs.map((tab, index) => (
              <button
                aria-controls={tab.panelId}
                aria-selected={activeIndex === index}
                className={`beauty-curated-tab${activeIndex === index ? " is-active" : ""}`}
                id={`${sectionId}-tab-${index}`}
                key={tab.panelId}
                onClick={() => setActiveIndex(index)}
                role="tab"
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="beauty-curated-panels">
        {panels.map((panel, index) => (
          <div
            aria-labelledby={`${sectionId}-tab-${index}`}
            className="beauty-curated-panel"
            hidden={activeIndex !== index}
            id={tabs[index]?.panelId ?? `${sectionId}-panel-${index}`}
            key={tabs[index]?.panelId ?? index}
            role="tabpanel"
          >
            {panel}
          </div>
        ))}
      </div>
    </div>
  );
}
