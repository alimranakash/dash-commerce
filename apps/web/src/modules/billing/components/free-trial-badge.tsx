"use client";

import { Clock3, Lock } from "lucide-react";
import Link from "next/link";
import { useFreeTrial } from "./free-trial-provider";

/**
 * The free-year countdown in the dashboard topbar.
 *
 * Days only, by design: an hours-and-minutes ticker turns a generous offer into
 * a pressure tactic, and the seller only ever needs to act at day granularity.
 * It turns amber inside the last month and red once the year is up, so the
 * deadline is felt before it arrives rather than only after.
 */
export function FreeTrialBadge() {
  const trial = useFreeTrial();

  if (!trial) {
    return null;
  }

  if (trial.isExpired) {
    return (
      <Link
        className="flex items-center gap-1.5 rounded-lg bg-[#fee2e2] px-2.5 py-2 font-semibold text-[#b91c1c] ring-1 ring-inset ring-[#fecaca] hover:bg-[#fecaca]"
        href="/dashboard/billing"
        title="Your free year has ended. Upgrade to continue."
      >
        <Lock className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Free year ended</span>
        <span className="sm:hidden">Locked</span>
      </Link>
    );
  }

  const urgent = trial.daysRemaining <= 30;

  return (
    <Link
      className={`hidden items-center gap-1.5 rounded-lg px-2.5 py-2 font-semibold ring-1 ring-inset sm:flex ${
        urgent
          ? "bg-[#fef3c7] text-[#b45309] ring-[#fde68a] hover:bg-[#fde68a]"
          : "bg-[#f3f0ff] text-[#5b34d6] ring-[#e2d9ff] hover:bg-[#e9e2ff]"
      }`}
      href="/dashboard/billing"
      title={`Your free year runs until ${trial.endsAtLabel}.`}
    >
      <Clock3 className="h-3.5 w-3.5" />
      {trial.daysRemaining} {trial.daysRemaining === 1 ? "day" : "days"} free left
    </Link>
  );
}
