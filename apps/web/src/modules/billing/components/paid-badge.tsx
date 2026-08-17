import { Crown } from "lucide-react";
import Link from "next/link";
import { minPlanForFeature } from "../../admin/plan-catalog";
import { PLAN_FEATURE_REGISTRY, type PlanFeatureKey } from "../plan-features";

/**
 * Where an unentitled seller is sent to upgrade. The billing page lives under
 * /dashboard, not /settings — see app/dashboard/billing/page.tsx.
 */
export const BILLING_UPGRADE_PATH = "/dashboard/billing";

/** The dashboard's own violet chip, so the badge sits in the existing palette. */
const BADGE_CLASS =
  "inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f0ebff] py-0.5 text-[10px] font-bold leading-4 text-[#6d3cf5] ring-1 ring-[#e0d7ff]";

/**
 * The paid-feature pill. Presentational only — it never touches the database,
 * which is why it lives apart from `feature-gate.tsx`: that module pulls in
 * Prisma via `hasPlanFeature`, so importing the badge from there into a client
 * component (the dashboard nav) would drag the server client into the browser
 * bundle.
 *
 * A crown carries the meaning on its own, so the default is icon-only and the
 * word "Paid" is gone. Pass `showPlan` where there is room for the tier name
 * ("Starter") next to it. Either way the accessible name is spelled out, since
 * an icon alone tells a screen reader nothing.
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
  /** Show the unlocking plan's name ("Growth") beside the padlock. */
  showPlan?: boolean | undefined;
}) {
  const minPlan = minPlanForFeature(feature);
  const text = label ?? (showPlan && minPlan ? minPlan : null);
  const title = minPlan
    ? `${PLAN_FEATURE_REGISTRY[feature].label} is included in the ${minPlan} plan. Upgrade to enable it.`
    : `${PLAN_FEATURE_REGISTRY[feature].label} is not included in your current plan.`;
  // Squarer padding when there is no text, so the pill stays circular.
  const className = `${BADGE_CLASS} ${text ? "px-2" : "px-1"}`;
  const content = (
    <>
      {/* Filled, not outlined, and inheriting the pill's violet: a 2px outline at
          12px leaves ~2px of interior space and reads as blurry. */}
      <Crown aria-hidden="true" className="h-3 w-3" fill="currentColor" strokeWidth={1.5} />
      {text ? <span>{text}</span> : null}
    </>
  );

  if (!interactive) {
    return (
      <span aria-label={title} className={className} role="img" title={title}>
        {content}
      </span>
    );
  }

  return (
    <Link
      aria-label={title}
      className={`${className} transition hover:bg-[#e6dcff]`}
      href={BILLING_UPGRADE_PATH}
      title={title}
    >
      {content}
    </Link>
  );
}
