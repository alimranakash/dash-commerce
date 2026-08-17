"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { PlanUpgradeDialog } from "./plan-upgrade-dialog";
import type { PlanFeatureKey } from "../plan-features";

type UpgradePrompt = {
  /** Opens the upgrade dialog for a feature. Ignores `undefined`/`null`. */
  openUpgrade: (feature: PlanFeatureKey | null | undefined) => void;
};

const PlanUpgradeContext = createContext<UpgradePrompt | null>(null);

/**
 * One upgrade dialog for the whole dashboard, mounted in `DashboardShell`.
 *
 * Every gated surface would otherwise need its own dialog plus dismiss state;
 * with this, a caller only has to hand back the `lockedFeature` a server action
 * returned. The dialog is presentation — the real block stays in the action.
 */
export function PlanUpgradeProvider({ children }: { children: ReactNode }) {
  const [feature, setFeature] = useState<PlanFeatureKey | null>(null);

  const value = useMemo<UpgradePrompt>(
    () => ({
      openUpgrade: (next) => {
        if (next) {
          setFeature(next);
        }
      }
    }),
    []
  );

  return (
    <PlanUpgradeContext.Provider value={value}>
      {children}
      <PlanUpgradeDialog feature={feature} onClose={() => setFeature(null)} />
    </PlanUpgradeContext.Provider>
  );
}

/**
 * No-ops outside the provider so a gated component can still be rendered in
 * isolation (storefront, tests) without blowing up.
 */
export function useUpgradePrompt(): UpgradePrompt {
  const context = useContext(PlanUpgradeContext);
  const fallback = useCallback(() => undefined, []);

  return context ?? { openUpgrade: fallback };
}
