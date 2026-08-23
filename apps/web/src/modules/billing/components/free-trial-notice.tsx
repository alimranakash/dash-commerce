"use client";

import { Gift, Lock } from "lucide-react";
import { useFreeTrial } from "./free-trial-provider";

/**
 * The full-width free-year panel at the top of Billing.
 *
 * Billing is where an expired store is redirected to and the only page it can
 * still open, so this carries the whole explanation: what stopped, why, and what
 * turns it back on. Before expiry it stays celebratory — the seller is inside a
 * gift, not a countdown to a bill.
 *
 * Reads the same context the topbar badge does, so the two can never disagree.
 */
export function FreeTrialNotice() {
  const trial = useFreeTrial();

  if (!trial) {
    return null;
  }

  if (trial.isExpired) {
    return (
      <section className="flex flex-col gap-4 rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-5 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#fee2e2] text-[#dc2626]">
          <Lock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <b className="block text-[15px] font-semibold text-[#7f1d1d]">
            Your free year has ended
          </b>
          <p className="mt-1 text-[13px] leading-relaxed text-[#a3283f]">
            Your dashboard is locked and your storefront has stopped accepting orders. Pick a plan
            below and submit the payment to switch everything back on — your products, orders, and
            customers are all still here, exactly as you left them.
          </p>
        </div>
      </section>
    );
  }

  const elapsed =
    trial.totalDays === null
      ? null
      : Math.min(100, Math.max(0, ((trial.totalDays - trial.daysRemaining) / trial.totalDays) * 100));

  return (
    <section className="rounded-2xl border border-[#ded5ff] bg-gradient-to-br from-[#f6f3ff] to-[#eef2ff] p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-[#6941ff] shadow-sm">
          <Gift className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <b className="block text-[15px] font-semibold text-[#241f4d]">
            {trial.daysRemaining} {trial.daysRemaining === 1 ? "day" : "days"} left in your free
            year
          </b>
          <p className="mt-1 text-[13px] text-[#5b5a76]">
            Everything on the Free plan stays free until {trial.endsAtLabel}. No card, no charge,
            no reminders until then.
          </p>
        </div>
      </div>
      {elapsed === null ? null : (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-[#e3dcff]">
          <div
            className="h-full rounded-full bg-[#6941ff] transition-[width] duration-500"
            style={{ width: `${100 - elapsed}%` }}
          />
        </div>
      )}
    </section>
  );
}
