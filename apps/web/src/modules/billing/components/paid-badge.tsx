import Link from "next/link";
import { minPlanForFeature } from "../../admin/plan-catalog";
import { PLAN_FEATURE_REGISTRY, type PlanFeatureKey } from "../plan-features";

/**
 * Where an unentitled seller is sent to upgrade. The billing page lives under
 * /dashboard, not /settings — see app/dashboard/billing/page.tsx.
 */
export const BILLING_UPGRADE_PATH = "/dashboard/billing";

const BADGE_CLASS =
  "inline-flex shrink-0 items-center rounded-full bg-[#f0ebff] px-2 py-0.5 text-[10px] font-bold leading-4 text-[#6d3cf5] ring-1 ring-[#e0d7ff]";

/**
 * The "Paid" pill. Presentational only — it never touches the database, which is
 * why it lives apart from `feature-gate.tsx`: that module pulls in Prisma via
 * `hasPlanFeature`, so importing the badge from there into a client component
 * (the dashboard nav) would drag the server client into the browser bundle.
 *
 * Set `interactive={false}` when rendering inside an existing link — nested
 * anchors are invalid HTML — which is the case for every sidebar nav row.
 */
export function PaidBadge({
  feature,
  interactive = true,
  label,
  showPlan = false
}: {
  feature: PlanFeatureKey;
  /** Render a plain span instead of a link to the billing page. */
  interactive?: boolean | undefined;
  label?: string | undefined;
  /** Show the unlocking plan's name ("Growth") instead of the generic "Paid". */
  showPlan?: boolean | undefined;
}) {
  const minPlan = minPlanForFeature(feature);
  const text = label ?? (showPlan && minPlan ? minPlan : "Paid");
  const title = minPlan
    ? `${PLAN_FEATURE_REGISTRY[feature].label} is included in the ${minPlan} plan. Upgrade to enable it.`
    : `${PLAN_FEATURE_REGISTRY[feature].label} is not included in your current plan.`;

  if (!interactive) {
    return (
      <span className={BADGE_CLASS} title={title}>
        {text}
      </span>
    );
  }

  return (
    <Link className={`${BADGE_CLASS} transition hover:bg-[#e6dcff]`} href={BILLING_UPGRADE_PATH} title={title}>
      {text}
    </Link>
  );
}
