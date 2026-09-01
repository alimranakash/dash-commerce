"use client";

import { useEffect } from "react";
import { useUpgradePrompt } from "./plan-upgrade-provider";
import type { PlanFeatureKey } from "../plan-features";

/**
 * Opens the shared upgrade dialog for a refusal that arrived as a **redirect**
 * rather than as action state.
 *
 * Most gated forms are `useActionState` and hand back a `lockedFeature` the form
 * reads directly. A few actions — Search & Discovery is the one — report by
 * redirecting with a query param instead, so there is no state object to carry
 * the key. The page parses it, narrows it with `isPlanFeatureKey`, and renders
 * this: a component with no markup whose whole job is to turn that param into
 * the same dialog every other gated surface opens.
 *
 * Renders nothing, and no-ops on `null`, so a page can mount it unconditionally.
 */
export function LockedFeaturePrompt({ feature }: { feature: PlanFeatureKey | null }) {
  const { openUpgrade } = useUpgradePrompt();

  useEffect(() => {
    openUpgrade(feature);
  }, [feature, openUpgrade]);

  return null;
}
