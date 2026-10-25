"use client";

import { useActionState, useEffect } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import {
  adjustLoyaltyPointsAction,
  setLoyaltyMemberSuspendedAction,
  type LoyaltyMemberActionState
} from "../loyalty.actions";
import { LOYALTY_ADJUSTMENT_MAX } from "../loyalty.rules";
import { LOYALTY_NOTE_MAX } from "../loyalty.schema";

const idle: LoyaltyMemberActionState = { status: "idle" };

/**
 * The owner's controls on one membership: a manual adjustment and the
 * suspend/resume switch. Only drawn for owners and admins, and every action
 * behind it checks again.
 *
 * The adjustment form carries a request id minted by the server. A double
 * click or a resubmitted form sends the same id and is recorded once; the id
 * only changes after the server has said the last one landed, which is also
 * when the form clears.
 */
export function LoyaltyMemberActions({
  memberId,
  requestId,
  status
}: {
  memberId: string;
  requestId: string;
  status: "ACTIVE" | "SUSPENDED";
}) {
  const [adjustState, adjustAction, adjusting] = useActionState(adjustLoyaltyPointsAction, idle);
  const [suspendState, suspendAction, switching] = useActionState(
    setLoyaltyMemberSuspendedAction,
    idle
  );
  const { openUpgrade } = useUpgradePrompt();
  const currentRequestId = adjustState.nextRequestId ?? requestId;
  const memberStatus = suspendState.memberStatus ?? status;

  // A plan refusal opens the shared upgrade dialog rather than reading as a
  // validation error the seller could fix by editing the fields.
  useEffect(() => {
    openUpgrade(adjustState.lockedFeature);
  }, [openUpgrade, adjustState]);

  useEffect(() => {
    openUpgrade(suspendState.lockedFeature);
  }, [openUpgrade, suspendState]);

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="grid content-start gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <header className="grid gap-1">
          <h2 className="m-0 text-base font-semibold text-[#252238]">Adjust points</h2>
          <p className="m-0 text-xs leading-relaxed text-[#77748a]">
            A minus sign takes points away, and a deduction cannot take the balance below zero.
            The reason and your name are kept with the entry.
          </p>
        </header>
        {adjustState.status === "error" && !adjustState.lockedFeature ? (
          <p className="m-0 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {adjustState.message}
          </p>
        ) : null}
        {adjustState.status === "saved" ? (
          <p className="m-0 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {adjustState.message}
          </p>
        ) : null}
        {/* Keyed by the request id, so the fields clear once an adjustment lands. */}
        <form action={adjustAction} className="grid gap-4" key={currentRequestId}>
          <input name="memberId" type="hidden" value={memberId} />
          <input name="requestId" type="hidden" value={currentRequestId} />
          <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
            Points
            <input
              className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              max={LOYALTY_ADJUSTMENT_MAX}
              min={-LOYALTY_ADJUSTMENT_MAX}
              name="points"
              placeholder="e.g. 50 or -20"
              required
              step={1}
              type="number"
            />
            {adjustState.fieldErrors?.points ? (
              <small className="text-xs text-rose-600">{adjustState.fieldErrors.points}</small>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
            Reason
            <textarea
              className="rounded-lg border border-[#e4e3ee] px-3 py-2 text-sm"
              maxLength={LOYALTY_NOTE_MAX}
              name="reason"
              placeholder="e.g. Points for an order placed under another number"
              required
              rows={3}
            />
            {adjustState.fieldErrors?.reason ? (
              <small className="text-xs text-rose-600">{adjustState.fieldErrors.reason}</small>
            ) : null}
          </label>
          <div>
            <button
              className="inline-flex h-11 items-center rounded-lg bg-[#6d3cf5] px-5 text-sm font-semibold text-white transition hover:bg-[#5b2fe0] disabled:opacity-70"
              disabled={adjusting}
              type="submit"
            >
              {adjusting ? "Saving..." : "Record adjustment"}
            </button>
          </div>
        </form>
      </section>

      <section className="grid content-start gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <header className="grid gap-1">
          <h2 className="m-0 text-base font-semibold text-[#252238]">
            {memberStatus === "ACTIVE" ? "Suspend membership" : "Resume membership"}
          </h2>
          <p className="m-0 text-xs leading-relaxed text-[#77748a]">
            While suspended, no new points are earned, but a cancelled or refunded order still gives
            its points back. The balance and history are kept either way.
          </p>
        </header>
        {suspendState.status === "error" && !suspendState.lockedFeature ? (
          <p className="m-0 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {suspendState.message}
          </p>
        ) : null}
        {suspendState.status === "saved" ? (
          <p className="m-0 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {suspendState.message}
          </p>
        ) : null}
        <form action={suspendAction}>
          <input name="memberId" type="hidden" value={memberId} />
          <input
            name="intent"
            type="hidden"
            value={memberStatus === "ACTIVE" ? "suspend" : "resume"}
          />
          <button
            className="inline-flex h-11 items-center rounded-lg bg-[#6d3cf5] px-5 text-sm font-semibold text-white transition hover:bg-[#5b2fe0] disabled:opacity-70"
            disabled={switching}
            type="submit"
          >
            {switching ? "Saving..." : memberStatus === "ACTIVE" ? "Suspend" : "Resume"}
          </button>
        </form>
      </section>
    </div>
  );
}
