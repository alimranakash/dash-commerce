"use client";

import { Loader2, Wallet } from "lucide-react";
import { useState, useTransition } from "react";
import { refreshCourierBalanceAction } from "../courier.actions";
import type { CourierBalanceView } from "../courier-insight.service";

/**
 * Capability-gated balance readout. Rendered only when a provider declares
 * `capabilities.balance`, so a carrier without the endpoint shows nothing at all
 * rather than an empty row.
 *
 * A stale figure with its timestamp is deliberately preferred to an error state.
 */
export function CourierBalance({
  balance,
  showRefresh = true
}: {
  balance: CourierBalanceView | null;
  showRefresh?: boolean;
}) {
  const [note, setNote] = useState<string | null>(balance?.error ?? null);
  const [isPending, startTransition] = useTransition();

  if (!balance) {
    return null;
  }

  const providerKey = balance.provider;

  function refresh() {
    startTransition(async () => {
      const result = await refreshCourierBalanceAction(providerKey);

      setNote(result.status === "success" ? null : result.message ?? null);
    });
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <Wallet className="h-3.5 w-3.5 text-[#7548f5]" />
        <span className="text-xs text-[#777985]">{balance.providerLabel} balance</span>
        <strong className="text-sm tabular-nums text-[#20212a]">
          {balance.amount === null ? "—" : `৳${balance.amount.toLocaleString("en-BD")}`}
        </strong>
        {balance.checkedAt ? (
          <span className="text-[10px] text-[#a2a3b0]">
            as of {formatTime(balance.checkedAt)}
            {balance.stale ? " · stale" : ""}
          </span>
        ) : null}
        {showRefresh ? (
          <button
            className="ml-auto inline-flex h-7 items-center gap-1 rounded-lg border border-[#dcd9e8] bg-white px-2.5 text-[10px] font-semibold text-[#5f616d] hover:border-[#bdb6da] hover:bg-[#faf9ff] disabled:opacity-60"
            disabled={isPending}
            onClick={refresh}
            type="button"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            Refresh
          </button>
        ) : null}
      </div>
      {note ? <p className="m-0 text-[11px] leading-5 text-amber-700">{note}</p> : null}
    </div>
  );
}

function formatTime(value: Date) {
  return new Intl.DateTimeFormat("en", { timeStyle: "short" }).format(new Date(value));
}
