"use client";

import { Loader2, Truck } from "lucide-react";
import { useState, useTransition } from "react";
import { sendOrderToCourierAction, type CourierActionState } from "../courier.actions";

/**
 * The one-click send.
 *
 * Disabled while a request is in flight, which is the first of the layered
 * double-send guards — the DB unique constraint is the one that actually
 * guarantees it, but not letting the button fire twice is cheaper.
 */
export function SendToCourierButton({
  courierLabel,
  disabledReason,
  orderId,
  provider,
  variant = "primary"
}: {
  courierLabel: string;
  disabledReason?: string | undefined;
  orderId: string;
  provider?: string | undefined;
  variant?: "primary" | "quiet";
}) {
  const [state, setState] = useState<CourierActionState>({ status: "idle" });
  const [isPending, startTransition] = useTransition();
  const blocked = Boolean(disabledReason);

  const className =
    variant === "primary"
      ? "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#7548f5] px-3.5 text-xs font-semibold text-white transition hover:bg-[#6436e8] disabled:cursor-not-allowed disabled:opacity-60"
      : "flex min-h-11 w-full items-center gap-2 rounded-lg border border-[#dedcea] bg-white px-3.5 text-left text-xs font-semibold text-[#555762] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60";

  function send() {
    startTransition(async () => {
      setState(await sendOrderToCourierAction(orderId, provider));
    });
  }

  return (
    <div className="grid gap-2">
      <button
        className={className}
        disabled={isPending || blocked}
        onClick={send}
        title={disabledReason ?? undefined}
        type="button"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
        {isPending ? "Sending…" : `Send to ${courierLabel}`}
      </button>
      {blocked ? <p className="m-0 text-[11px] leading-5 text-[#777985]">{disabledReason}</p> : null}
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
