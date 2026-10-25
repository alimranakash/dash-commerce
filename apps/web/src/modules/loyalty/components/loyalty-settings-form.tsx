"use client";

import { useActionState, useEffect, useState } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import { saveLoyaltySettingsAction, type LoyaltySettingsState } from "../loyalty.actions";
import { pointsForBase, redemptionLimits, toCents } from "../loyalty.rules";
import { LOYALTY_PROGRAM_NAME_MAX, type LoyaltySettings } from "../loyalty.schema";
import type { LoyaltyCapability } from "../loyalty.service";

type LoyaltySettingsFormProps = {
  canManage: boolean;
  capability: LoyaltyCapability;
  currency: string;
  settings: LoyaltySettings;
};

const initialState: LoyaltySettingsState = {
  status: "idle"
};

/** The basket the preview prices. Not a round number, so the rounding shows. */
const EXAMPLE_GOODS = "1250";

/** The balance the redemption preview spends from. */
const EXAMPLE_BALANCE = 500;

export function LoyaltySettingsForm({
  canManage,
  capability: initialCapability,
  currency,
  settings
}: LoyaltySettingsFormProps) {
  const [state, formAction, isPending] = useActionState(saveLoyaltySettingsAction, initialState);
  const { openUpgrade } = useUpgradePrompt();
  const capability = state.capability ?? initialCapability;
  const saved = state.settings ?? settings;
  const [enabled, setEnabled] = useState(saved.enabled);
  const [amountPerPoint, setAmountPerPoint] = useState(saved.amountPerPoint);
  const [redemptionEnabled, setRedemptionEnabled] = useState(saved.redemptionEnabled);
  const [pointValue, setPointValue] = useState(saved.pointValue);
  const [minRedeemPoints, setMinRedeemPoints] = useState(String(saved.minRedeemPoints));
  const [maxRedeemPercent, setMaxRedeemPercent] = useState(String(saved.maxRedeemPercent));

  // A plan refusal opens the shared upgrade dialog rather than reading as a
  // validation error the seller could fix by editing the fields.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);

  // The same function earning will use, so what the seller reads here is what
  // a customer would be given.
  const examplePoints = pointsForBase(toCents(EXAMPLE_GOODS) ?? 0, amountPerPoint);
  // And the same limits checkout will apply to a redemption.
  const exampleRedemption = redemptionLimits({
    balance: EXAMPLE_BALANCE,
    eligibleGoodsCents: toCents(EXAMPLE_GOODS) ?? 0,
    policy: {
      maxRedeemPercent: Number(maxRedeemPercent) || 0,
      minRedeemPoints: Number(minRedeemPoints) || 0,
      pointValue
    }
  });

  return (
    <form action={formAction} className="grid max-w-3xl gap-5">
      {state.status === "error" && !state.lockedFeature ? (
        <p className="m-0 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message}</p>
      ) : null}
      {state.status === "saved" ? (
        <p className="m-0 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {state.message}
        </p>
      ) : null}
      {capability.enabled && !capability.entitled ? (
        <p className="m-0 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          The programme is switched on, but your plan no longer includes Loyalty, so it is not
          running. You can still switch it off.
        </p>
      ) : null}
      {!canManage ? (
        <p className="m-0 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Only the store owner or an admin can change these settings.
        </p>
      ) : null}

      <fieldset className="m-0 grid gap-5 border-0 p-0" disabled={!canManage}>
        <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
          <label className="flex items-start gap-3">
            <input
              checked={enabled}
              className="mt-1 h-4 w-4"
              name="enabled"
              onChange={(event) => setEnabled(event.target.checked)}
              type="checkbox"
            />
            <span className="grid gap-1">
              <strong className="text-sm font-semibold text-[#252238]">Run the programme</strong>
              <small className="text-xs leading-relaxed text-[#77748a]">
                Joining is free for your customers. Points are earned once you mark an order
                Completed, and an order you mark fake never earns.
              </small>
            </span>
          </label>
          <p className="m-0 rounded-lg bg-[#f6f3ff] px-4 py-3 text-sm text-[#3d2279]">
            Customers join by ticking a box at checkout. Only orders placed after they join earn
            points, and a cancelled, refunded or returned order gives its points back.
          </p>
        </section>

        <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
          <header className="grid gap-1">
            <h2 className="m-0 text-base font-semibold text-[#252238]">Earning</h2>
            <p className="m-0 text-xs leading-relaxed text-[#77748a]">
              Points are worked out on the goods after every discount. Delivery charges never earn,
              and part-points are rounded down.
            </p>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
              Programme name
              <input
                className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
                defaultValue={saved.programName}
                maxLength={LOYALTY_PROGRAM_NAME_MAX}
                name="programName"
                placeholder="Rewards"
                type="text"
              />
              {state.fieldErrors?.programName ? (
                <small className="text-xs text-rose-600">{state.fieldErrors.programName}</small>
              ) : null}
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
              {`Spend per point (${currency})`}
              <input
                className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
                min={0.01}
                name="amountPerPoint"
                onChange={(event) => setAmountPerPoint(event.target.value)}
                step="0.01"
                type="number"
                value={amountPerPoint}
              />
              {state.fieldErrors?.amountPerPoint ? (
                <small className="text-xs text-rose-600">{state.fieldErrors.amountPerPoint}</small>
              ) : null}
            </label>
          </div>
          <p className="m-0 rounded-lg bg-[#f6f3ff] px-4 py-3 text-sm text-[#3d2279]">
            An order with {formatMoney(EXAMPLE_GOODS, currency)} in goods would earn{" "}
            <strong>
              {examplePoints} {examplePoints === 1 ? "point" : "points"}
            </strong>
            .
          </p>
        </section>

        <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
          <label className="flex items-start gap-3">
            <input
              checked={redemptionEnabled}
              className="mt-1 h-4 w-4"
              name="redemptionEnabled"
              onChange={(event) => setRedemptionEnabled(event.target.checked)}
              type="checkbox"
            />
            <span className="grid gap-1">
              <strong className="text-sm font-semibold text-[#252238]">
                Let members spend points at checkout
              </strong>
              <small className="text-xs leading-relaxed text-[#77748a]">
                A member confirms their number with an SMS code from your allowance, then chooses
                how many points to use. Points come off the goods after any bundle and coupon
                discount, never off delivery. A cancelled order gives its points back.
              </small>
            </span>
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
              {`One point is worth (${currency})`}
              <input
                className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
                min={0.01}
                name="pointValue"
                onChange={(event) => setPointValue(event.target.value)}
                step="0.01"
                type="number"
                value={pointValue}
              />
              {state.fieldErrors?.pointValue ? (
                <small className="text-xs text-rose-600">{state.fieldErrors.pointValue}</small>
              ) : null}
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
              Minimum points per use
              <input
                className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
                min={1}
                name="minRedeemPoints"
                onChange={(event) => setMinRedeemPoints(event.target.value)}
                step={1}
                type="number"
                value={minRedeemPoints}
              />
              {state.fieldErrors?.minRedeemPoints ? (
                <small className="text-xs text-rose-600">{state.fieldErrors.minRedeemPoints}</small>
              ) : null}
            </label>
            <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
              Most of an order points may cover (%)
              <input
                className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
                max={100}
                min={1}
                name="maxRedeemPercent"
                onChange={(event) => setMaxRedeemPercent(event.target.value)}
                step={1}
                type="number"
                value={maxRedeemPercent}
              />
              {state.fieldErrors?.maxRedeemPercent ? (
                <small className="text-xs text-rose-600">{state.fieldErrors.maxRedeemPercent}</small>
              ) : null}
            </label>
          </div>
          <p className="m-0 rounded-lg bg-[#f6f3ff] px-4 py-3 text-sm text-[#3d2279]">
            {exampleRedemption.available
              ? `A member holding ${EXAMPLE_BALANCE} points could use up to ${exampleRedemption.maxPoints} of them on a ${formatMoney(EXAMPLE_GOODS, currency)} order, taking ${formatMoney(((exampleRedemption.maxPoints * exampleRedemption.pointValueCents) / 100).toFixed(2), currency)} off.`
              : `With these limits, a ${formatMoney(EXAMPLE_GOODS, currency)} order could not take the minimum number of points.`}
          </p>
        </section>

        <div>
          <button
            className="inline-flex h-11 items-center rounded-lg bg-[#6d3cf5] px-5 text-sm font-semibold text-white transition hover:bg-[#5b2fe0] disabled:opacity-70"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Saving..." : "Save settings"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value) || 0);
}
