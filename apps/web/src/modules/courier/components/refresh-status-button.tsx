"use client";

import { Loader2, RefreshCcw } from "lucide-react";
import { useState, useTransition } from "react";
import { refreshShipmentStatusAction, type CourierActionState } from "../courier.actions";

/**
 * The manual half of the status pipeline. It produces exactly the same update a
 * webhook will in Phase 6 — this button just asks for it rather than waiting.
 */
export function RefreshStatusButton({
  orderId,
  shipmentId
}: {
  orderId: string;
  shipmentId: string;
}) {
  const [state, setState] = useState<CourierActionState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      setState(await refreshShipmentStatusAction(shipmentId, orderId));
    });
  }

  return (
    <div className="grid gap-2">
      <button
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#dcd9e8] bg-white px-3 text-[11px] font-semibold text-[#5f616d] transition hover:border-[#bdb6da] hover:bg-[#faf9ff] disabled:cursor-not-allowed disabled:opacity-60"
        disabled={isPending}
        onClick={refresh}
        type="button"
      >
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCcw className="h-3.5 w-3.5" />
        )}
        {isPending ? "Checking…" : "Refresh status"}
      </button>
      {state.status !== "idle" && state.message ? (
        <p className={`m-0 rounded-lg px-3 py-2 text-[11px] leading-5 ${toneClass(state.status)}`}>
          {state.message}
        </p>
      ) : null}
    </div>
  );
}

function toneClass(status: CourierActionState["status"]) {
  if (status === "success") {
    return "bg-emerald-50 text-emerald-700";
  }

  if (status === "warning") {
    return "bg-amber-50 text-amber-700";
  }

  return "bg-rose-50 text-rose-700";
}
