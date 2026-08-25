"use client";

import { Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { blockOrderIpAction, blockSuggestedIpAction, unblockIpAction } from "../blocked-ip.actions";

export function UnblockButton({ blockedIpId, ipAddress }: { blockedIpId: string; ipAddress: string }) {
  return (
    <ActionButton
      className="rounded-md border border-[#e5e3f1] px-2.5 py-1.5 text-xs font-medium text-[#555762] transition hover:bg-[#f7f7fb] disabled:cursor-not-allowed disabled:opacity-60"
      idleLabel="Unblock"
      pendingLabel="Unblocking..."
      run={() => unblockIpAction(blockedIpId)}
      title={`Unblock ${ipAddress}`}
    />
  );
}

export function BlockSuggestionButton({ ipAddress }: { ipAddress: string }) {
  return (
    <ActionButton
      className="rounded-md border border-[#f5c9d0] px-2.5 py-1.5 text-xs font-semibold text-[#f05268] transition hover:bg-[#fdf2f4] disabled:cursor-not-allowed disabled:opacity-60"
      idleLabel="Block"
      pendingLabel="Blocking..."
      run={() => blockSuggestedIpAction(ipAddress)}
      title={`Block ${ipAddress}`}
    />
  );
}

/**
 * The review pages' entry point into the blocklist.
 *
 * Confirms first because unlike the suggestion list — where the counts that
 * justify the block are on the row being clicked — this button is next to a
 * single order, and one bad order is a much weaker reason to shut an address out.
 */
export function BlockOrderIpButton({ ipAddress, orderId }: { ipAddress: string; orderId: string }) {
  return (
    <ActionButton
      className="h-8 rounded-lg border border-red-200 px-3 text-[11px] font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
      confirm={`Block ${ipAddress} from placing orders on this store?`}
      idleLabel="Block this IP"
      pendingLabel="Blocking..."
      run={() => blockOrderIpAction(orderId)}
      title={`Block ${ipAddress}`}
    />
  );
}

type ActionResult = { message?: string | undefined; status: string };

function ActionButton({
  className,
  confirm,
  idleLabel,
  pendingLabel,
  run,
  title
}: {
  className: string;
  confirm?: string;
  idleLabel: string;
  pendingLabel: string;
  run: () => Promise<ActionResult>;
  title: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (confirm && !window.confirm(confirm)) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await run();

      // A success revalidates and the row re-renders itself; only a refusal has
      // anything left to say.
      if (result.status === "error") {
        setError(result.message ?? "That did not work. Try again.");
      }
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <button className={className} disabled={pending} onClick={onClick} title={title} type="button">
        {pending ? (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 aria-hidden="true" className="h-3 w-3 animate-spin" />
            {pendingLabel}
          </span>
        ) : (
          idleLabel
        )}
      </button>
      {error ? (
        <p aria-live="polite" className="m-0 max-w-xs text-right text-xs text-[#b3273f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
