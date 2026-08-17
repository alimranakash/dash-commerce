"use client";

import { Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { minPlanForFeature } from "../../admin/plan-catalog";
import { PLAN_FEATURE_REGISTRY, type PlanFeatureKey } from "../plan-features";
import { BILLING_UPGRADE_PATH } from "./paid-badge";

/**
 * Shown when a seller triggers something their plan does not include. Purely an
 * explanation — the real block is server-side in the action, so dismissing this
 * grants nothing.
 *
 * Reusable across any gated surface: pass the feature key, keep the open/close
 * state in the calling component.
 */
export function PlanUpgradeDialog({
  feature,
  onClose
}: {
  /** `null` closes the dialog. */
  feature: PlanFeatureKey | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!feature) {
      return;
    }

    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);

    return () => window.removeEventListener("keydown", close);
  }, [feature, onClose]);

  if (!feature) {
    return null;
  }

  const definition = PLAN_FEATURE_REGISTRY[feature];
  const minPlan = minPlanForFeature(feature);

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-[120] grid place-items-center bg-[#20212a]/45 p-4"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
      role="dialog"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#f3f0ff] text-[#6d3cf5]">
            <Sparkles className="h-5 w-5" />
          </div>
          <button
            aria-label="Close"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg border border-[#e6e4ef] text-[#626370] hover:bg-[#f7f5ff]"
            onClick={onClose}
            type="button"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 className="m-0 mt-4 text-xl font-semibold text-[#20212c]">{definition.label} is a paid feature</h2>
        <p className="m-0 mt-2 text-sm leading-6 text-[#74758a]">{definition.description}</p>
        {minPlan ? (
          <p className="m-0 mt-3 rounded-lg bg-[#f7f5ff] px-4 py-3 text-sm font-medium text-[#5b31db]">
            Included in the {minPlan} plan and above.
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button
            className="h-11 cursor-pointer rounded-lg border border-[#dedcf0] font-semibold text-[#30313d] hover:bg-[#f7f5ff]"
            onClick={onClose}
            type="button"
          >
            Not now
          </button>
          <Link
            className="grid h-11 cursor-pointer place-items-center rounded-lg bg-[#7c3aed] font-semibold text-white hover:bg-[#6d28d9]"
            href={BILLING_UPGRADE_PATH}
          >
            View Plans
          </Link>
        </div>
      </div>
    </div>
  );
}
