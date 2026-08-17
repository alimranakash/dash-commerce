"use client";

import { Loader2, ShieldQuestion } from "lucide-react";
import { useState, useTransition } from "react";
import { checkCourierScoreAction } from "../courier.actions";
import { minPlanForFeature } from "../../admin/plan-catalog";
import { PaidBadge } from "../../billing/components/paid-badge";
import { PlanUpgradeDialog } from "../../billing/components/plan-upgrade-dialog";
import type { CourierScoreBand, CourierScoreView } from "../courier-insight.service";

/**
 * Customer delivery history for the phone on this order.
 *
 * Read-only and advisory. A failed check degrades to whatever was cached, or to
 * an inline note — it never blocks the page or the order.
 */
export function CourierScoreCard({
  cached,
  editable = false,
  locked = false,
  phone
}: {
  cached: CourierScoreView | null;
  /** Renders a phone field so any number can be checked, not just this order's. */
  editable?: boolean;
  /** Resolved on the server so the card can explain itself before any click. */
  locked?: boolean;
  phone: string;
}) {
  const [score, setScore] = useState<CourierScoreView | null>(cached);
  const [note, setNote] = useState<string | null>(null);
  const [phoneValue, setPhoneValue] = useState(phone);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [isPending, startTransition] = useTransition();

  function check(force: boolean) {
    // Locked is known up front, so skip the round trip and explain immediately.
    if (locked) {
      setShowUpgrade(true);
      return;
    }

    startTransition(async () => {
      const result = await checkCourierScoreAction(phoneValue, force);

      if (result.lockedFeature) {
        setShowUpgrade(true);
        return;
      }

      setNote(result.message ?? null);

      if (result.score) {
        setScore(result.score);
      }
    });
  }

  const hasHistory = score !== null && score.totalParcels > 0;

  return (
    <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="mb-4 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <ShieldQuestion className="h-4 w-4 text-[#7548f5]" />
          <span className="grid">
            <h2 className="m-0 text-sm font-semibold text-[#20212a]">Fraud Check</h2>
            <span className="text-[10px] text-[#858691]">Customer delivery history</span>
          </span>
          {locked ? <PaidBadge feature="fraud_check" interactive={false} showPlan /> : null}
        </span>
        <button
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dcd9e8] bg-white px-3 text-[11px] font-semibold text-[#5f616d] transition hover:border-[#bdb6da] hover:bg-[#faf9ff] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isPending || (editable && !locked && !phoneValue.trim())}
          onClick={() => check(score !== null)}
          type="button"
        >
          {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {isPending ? "Checking…" : locked ? "Unlock" : score ? "Refresh" : "Check"}
        </button>
      </header>

      {editable ? (
        <label className="mb-4 grid gap-1.5">
          <span className="text-[11px] font-semibold text-[#5f616d]">Customer phone</span>
          <input
            className="h-10 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10"
            inputMode="tel"
            onChange={(event) => setPhoneValue(event.target.value)}
            placeholder="01XXXXXXXXX"
            value={phoneValue}
          />
        </label>
      ) : null}

      {locked ? (
        // Without this the card would say "no delivery history", which reads as a
        // fact about the customer rather than a feature the plan does not include.
        <div className="grid gap-3 rounded-lg border border-dashed border-[#dcd9e8] bg-[#faf9ff] p-3">
          <p className="m-0 text-xs leading-6 text-[#5f616d]">
            See how many parcels this customer has received, cancelled, or returned with other
            stores — so you can spot a risky cash-on-delivery order before you ship it.
          </p>
          <button
            className="inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#7c3aed] px-3 text-[11px] font-semibold text-white transition hover:bg-[#6d28d9]"
            onClick={() => setShowUpgrade(true)}
            type="button"
          >
            Unlock with {minPlanForFeature("fraud_check") ?? "a paid"} plan
          </button>
        </div>
      ) : hasHistory ? (
        <div className="grid gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums text-[#20212a]">
              {score.successRatio === null ? "—" : `${score.successRatio}%`}
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${bandTone(score.band)}`}>
              {bandLabel(score.band)}
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center text-xs">
            <Metric label="Parcels" value={score.totalParcels} />
            <Metric label="Delivered" value={score.totalDelivered} />
            <Metric label="Cancelled" value={score.totalCancelled ?? "—"} />
          </dl>
          {score.checkedAt ? (
            <p className="m-0 text-[11px] text-[#858691]">
              {score.providerLabel ? `${score.providerLabel} · ` : ""}checked {formatDate(score.checkedAt)}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="m-0 text-xs leading-6 text-[#777985]">
          {/* Never 0% — an unchecked or unknown customer is not a bad one. */}
          No delivery history for this number yet.
        </p>
      )}

      {note ? (
        <p className="m-0 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-700">
          {note}
        </p>
      ) : null}

      <PlanUpgradeDialog
        feature={showUpgrade ? "fraud_check" : null}
        onClose={() => setShowUpgrade(false)}
      />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-[#f8f7fc] px-2 py-2.5">
      <dt className="m-0 text-[10px] uppercase tracking-wide text-[#858691]">{label}</dt>
      <dd className="m-0 mt-0.5 text-sm font-semibold tabular-nums text-[#292a34]">{value}</dd>
    </div>
  );
}

function bandLabel(band: CourierScoreBand) {
  switch (band) {
    case "GOOD":
      return "Reliable";
    case "CAUTION":
      return "Caution";
    case "RISKY":
      return "Risky";
    case "LIMITED":
      return "Limited history";
    default:
      return "No history";
  }
}

function bandTone(band: CourierScoreBand) {
  switch (band) {
    case "GOOD":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "CAUTION":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "RISKY":
      return "border-rose-200 bg-rose-50 text-rose-700";
    default:
      return "border-[#e4e1ec] bg-[#f4f3f9] text-[#777985]";
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value)
  );
}
