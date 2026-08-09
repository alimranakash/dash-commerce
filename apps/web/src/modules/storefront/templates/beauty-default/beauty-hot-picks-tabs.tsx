"use client";

import type { ReactNode } from "react";
import { useState } from "react";

export type BeautyHotPicksTab = {
  label: string;
  panelId: string;
};

type BeautyHotPicksTabsProps = {
  // Same contract as the curated band: the panels are server-rendered grids that
  // arrive as a prop, so switching a chip only toggles `hidden` instead of
  // re-mounting every card.
  panels: ReactNode[];
  sectionId: string;
  tabs: BeautyHotPicksTab[];
};

export function BeautyHotPicksTabs({ panels, sectionId, tabs }: BeautyHotPicksTabsProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="beauty-hot-picks-body">
      {tabs.length > 1 ? (
        <div aria-label="Filter by category" className="beauty-hot-picks-tablist" role="tablist">
          {tabs.map((tab, index) => (
            <button
              aria-controls={tab.panelId}
              aria-selected={activeIndex === index}
              className={`beauty-hot-picks-tab${activeIndex === index ? " is-active" : ""}`}
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
      <div className="beauty-hot-picks-panels">
        {panels.map((panel, index) => (
          <div
            aria-labelledby={`${sectionId}-tab-${index}`}
            className="beauty-hot-picks-panel"
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
