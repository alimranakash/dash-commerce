"use client";

import { Button } from "@dash/ui";
import { CheckCircle2, PackageCheck, ThumbsUp, Trash2, Truck, XCircle } from "lucide-react";
import { useActionState, useEffect, useState } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import {
  advanceOrderReturnStatusFormAction,
  deleteOrderReturnFormAction,
  type OrderReturnActionState
} from "../return.actions";
import { orderRefundMethods, type OrderReturnStatus, type OrderReturnType } from "../return.schema";
import { orderRefundMethodLabels } from "../return.types";

type WorkflowStep = {
  icon: typeof ThumbsUp;
  label: string;
  status: OrderReturnStatus;
  style: string;
};

const initialState: OrderReturnActionState = {
  status: "idle"
};

/**
 * The moves that are open right now, and only those.
 *
 * Mirrors the transition table in return.service.ts rather than showing every
 * button greyed out: a seller looking at a received parcel should see "settle"
 * and "cancel", not five refusals waiting to happen. The service checks again on
 * every submit, so this is presentation, not protection.
 */
export function ReturnWorkflowActions({
  returnId,
  status,
  type
}: {
  returnId: string;
  status: string;
  type: string;
}) {
  const steps = nextSteps(status as OrderReturnStatus, type as OrderReturnType);

  if (steps.length === 0) {
    return (
      <p className="m-0 text-xs text-[#777985]">
        This request is closed. Nothing further can be changed on it.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {steps.map((step) => (
        <form
          action={advanceOrderReturnStatusFormAction.bind(null, returnId, step.status)}
          key={step.status}
        >
          <button
            className={`flex min-h-11 w-full items-center gap-2 rounded-lg border px-3.5 text-left text-xs font-semibold transition hover:brightness-95 ${step.style}`}
            type="submit"
          >
            <step.icon className="h-4 w-4" />
            {step.label}
          </button>
        </form>
      ))}
    </div>
  );
}

/**
 * The settle step: how the money went back, and the transaction id the seller
 * will be asked for later.
 *
 * Recording the payment and closing the request are one submit because they are
 * one moment at the counter — a request left "received" with the bKash already
 * sent is the state this avoids.
 */
export function ReturnRefundForm({
  action,
  currency,
  defaultMethod,
  refundAmount
}: {
  action: (state: OrderReturnActionState, formData: FormData) => Promise<OrderReturnActionState>;
  currency: string;
  defaultMethod: string;
  refundAmount: number;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();

  // A plan refusal opens the shared upgrade dialog rather than reading as a
  // validation error the seller could fix by editing the fields.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);

  return (
    <form action={formAction} className="grid gap-4">
      {state.status === "error" && state.message && !state.lockedFeature ? (
        <p className="error-message">{state.message}</p>
      ) : null}
      <p className="m-0 text-xs text-[#777985]">
        {refundAmount > 0
          ? `Settling this request records ${formatMoney(refundAmount, currency)} going back to the customer.`
          : "Nothing is owed back on this request — settling it just closes it out."}
      </p>
      <div>
        <label
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777985]"
          htmlFor="refundMethod"
        >
          Paid back by
        </label>
        <select
          className="h-11 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6]"
          defaultValue={defaultMethod}
          id="refundMethod"
          name="refundMethod"
        >
          {orderRefundMethods.map((method) => (
            <option key={method} value={method}>
              {orderRefundMethodLabels[method]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777985]"
          htmlFor="refundReference"
        >
          Transaction ID
        </label>
        <input
          className="h-11 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6]"
          id="refundReference"
          name="refundReference"
          placeholder="bKash / Nagad / bank reference"
        />
      </div>
      <div>
        <label
          className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777985]"
          htmlFor="resolutionNote"
        >
          Resolution note
        </label>
        <textarea
          className="min-h-20 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6]"
          id="resolutionNote"
          name="resolutionNote"
          placeholder="How it was settled, for whoever reads this later."
        />
      </div>
      <Button className="catalog-submit-button" disabled={isPending} type="submit">
        {isPending ? "Settling…" : "Record refund & settle"}
      </Button>
    </form>
  );
}

export function ReturnDeleteButton({ returnId }: { returnId: string }) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-white px-3.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
        onClick={() => setConfirming(true)}
        type="button"
      >
        <Trash2 className="h-4 w-4" />
        Delete request
      </button>
    );
  }

  return (
    <form
      action={deleteOrderReturnFormAction.bind(null, returnId)}
      className="flex items-center gap-2"
    >
      <span className="text-[11px] text-[#777985]">Delete for good?</span>
      <button
        className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-3.5 text-xs font-semibold text-white transition hover:bg-rose-700"
        type="submit"
      >
        <Trash2 className="h-4 w-4" />
        Yes, delete
      </button>
      <button
        className="inline-flex h-10 items-center rounded-lg border border-[#dedcea] bg-white px-3.5 text-xs font-semibold text-[#555762] hover:bg-[#f8f7fc]"
        onClick={() => setConfirming(false)}
        type="button"
      >
        Keep it
      </button>
    </form>
  );
}

function nextSteps(status: OrderReturnStatus, type: OrderReturnType): WorkflowStep[] {
  const cancel: WorkflowStep = {
    icon: XCircle,
    label: "Cancel request",
    status: "CANCELLED",
    style: "border-rose-200 bg-rose-50 text-rose-700"
  };

  if (status === "REQUESTED") {
    return [
      {
        icon: ThumbsUp,
        label: "Approve request",
        status: "APPROVED",
        style: "border-blue-200 bg-blue-50 text-blue-700"
      },
      {
        icon: XCircle,
        label: "Reject request",
        status: "REJECTED",
        style: "border-rose-200 bg-rose-50 text-rose-700"
      },
      cancel
    ];
  }

  if (status === "APPROVED") {
    // A refund collects nothing, so there is no parcel to track and the only
    // move left is settling it in the panel below.
    if (type === "REFUND") return [cancel];

    return [
      {
        icon: Truck,
        label: "Mark as coming back",
        status: "IN_TRANSIT",
        style: "border-sky-200 bg-sky-50 text-sky-700"
      },
      {
        icon: PackageCheck,
        label: "Mark goods received",
        status: "RECEIVED",
        style: "border-violet-200 bg-violet-50 text-violet-700"
      },
      cancel
    ];
  }

  if (status === "IN_TRANSIT") {
    return [
      {
        icon: PackageCheck,
        label: "Mark goods received",
        status: "RECEIVED",
        style: "border-violet-200 bg-violet-50 text-violet-700"
      },
      cancel
    ];
  }

  if (status === "RECEIVED") {
    return [
      {
        icon: CheckCircle2,
        label: "Settle without a refund",
        status: "COMPLETED",
        style: "border-emerald-200 bg-emerald-50 text-emerald-700"
      },
      cancel
    ];
  }

  return [];
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}
