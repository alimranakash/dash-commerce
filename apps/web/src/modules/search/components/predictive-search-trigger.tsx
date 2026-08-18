"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { PredictiveSearch } from "./predictive-search";

type PredictiveSearchTriggerProps = {
  className?: string | undefined;
  currency: string;
  iconClassName?: string | undefined;
  storeSlug: string;
};

/**
 * Search entry point for the templates whose header is a row of icons rather
 * than a search bar. Clicking drops a full-width panel below the header, which
 * keeps those layouts intact while still giving shoppers suggestions as they
 * type.
 */
export function PredictiveSearchTrigger({
  className,
  currency,
  iconClassName,
  storeSlug
}: PredictiveSearchTriggerProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={open ? "Close search" : "Search"}
        className={className}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? <X className={iconClassName} /> : <Search className={iconClassName} />}
      </button>

      {open ? (
        <div className="sf-search-overlay">
          {/*
            Clicking the backdrop closes the panel. It is not a control in its
            own right — Escape and the toggle button both do the same thing —
            so it stays out of the tab order and the accessibility tree.
          */}
          <div aria-hidden className="sf-search-overlay-backdrop" onClick={() => setOpen(false)} />
          <div className="sf-search-overlay-panel">
            <PredictiveSearch
              autoFocus
              currency={currency}
              onNavigate={() => setOpen(false)}
              storeSlug={storeSlug}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
