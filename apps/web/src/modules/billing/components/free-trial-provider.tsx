"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * The free year, reduced to what the dashboard chrome needs to draw it.
 *
 * Plain primitives rather than the server's `FreeTrialState`: this crosses the
 * server/client boundary on every dashboard page, and the end date is formatted
 * once on the server so every seller sees the same string regardless of what
 * locale their browser reports.
 */
export type FreeTrialSummary = {
  daysRemaining: number;
  endsAtLabel: string;
  isExpired: boolean;
  totalDays: number | null;
};

const FreeTrialContext = createContext<FreeTrialSummary | null>(null);

/**
 * Mounted once in the dashboard layout so the countdown can live in the topbar
 * without every one of the ~50 pages that render `DashboardShell` having to
 * fetch and thread it through.
 */
export function FreeTrialProvider({
  children,
  value
}: {
  children: ReactNode;
  value: FreeTrialSummary | null;
}) {
  return <FreeTrialContext.Provider value={value}>{children}</FreeTrialContext.Provider>;
}

/** `null` for a paid store, or outside the provider — callers render nothing. */
export function useFreeTrial() {
  return useContext(FreeTrialContext);
}
