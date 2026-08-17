import type { ReactNode } from "react";
import type { PlanFeatureKey } from "../plan-features";
import { hasPlanFeature } from "../subscription-limits";
import { BILLING_UPGRADE_PATH, PaidBadge } from "./paid-badge";

export { BILLING_UPGRADE_PATH, PaidBadge };

/**
 * Server-side feature gate, resolved against the store's current subscription
 * via `hasPlanFeature` — so it inherits the fail-closed contract (no/expired/
 * cancelled/past-due subscription grants nothing).
 *
 * Two shapes, one component:
 * - `<FeatureGate feature storeId />` with no children renders the badge only
 *   when locked, and nothing when entitled — for sitting beside a page heading.
 * - `<FeatureGate feature storeId>{ui}</FeatureGate>` renders `ui` when entitled
 *   and the badge otherwise.
 *
 * This is display only. Gated writes must still be guarded server-side with
 * `requirePlanFeature` in the service layer.
 */
export async function FeatureGate({
  children = null,
  fallback,
  feature,
  label,
  storeId
}: {
  children?: ReactNode | undefined;
  fallback?: ReactNode | undefined;
  feature: PlanFeatureKey;
  label?: string | undefined;
  storeId: string;
}) {
  if (await hasPlanFeature(storeId, feature)) {
    return <>{children}</>;
  }

  return <>{fallback ?? <PaidBadge feature={feature} label={label} showPlan />}</>;
}
