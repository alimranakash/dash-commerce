"use server";

import { requireStore } from "../stores/queries";
import { listPlanFeatures } from "./subscription-limits";
import type { PlanFeatureKey } from "./plan-features";

/**
 * Feature keys the current store is entitled to, for client components that need
 * to decorate their own UI — the dashboard sidebar's "Paid" badges being the
 * only caller today.
 *
 * Returns an empty list on any failure rather than throwing. The badge is
 * decorative, and an empty list simply shows it, which is the fail-closed
 * direction. Real enforcement stays in the service layer via
 * `requirePlanFeature`.
 */
export async function getEntitledFeaturesAction(): Promise<PlanFeatureKey[]> {
  try {
    // Read-only decoration, and the sidebar still draws on the billing page an
    // expired store is redirected to, so it opts out of the lock.
    const store = await requireStore({ allowLocked: true });
    return await listPlanFeatures(store.id);
  } catch {
    return [];
  }
}
