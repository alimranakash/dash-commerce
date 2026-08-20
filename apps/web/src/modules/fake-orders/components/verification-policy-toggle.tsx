"use client";

import { ShieldCheck, ShieldOff } from "lucide-react";
import { useTransition } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import { setCourierVerificationRequiredAction } from "../fake-order.actions";

/**
 * The store-level courier gate. Off by default, so this is the only place a
 * seller opts into "nothing ships until it is verified".
 */
export function VerificationPolicyToggle({ required }: { required: boolean }) {
  const { openUpgrade } = useUpgradePrompt();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-4 text-sm font-semibold transition disabled:opacity-60 ${
        required
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
          : "border-[#e4e3ee] text-[#565762] hover:bg-[#f7f7fa]"
      }`}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          openUpgrade((await setCourierVerificationRequiredAction(!required)).lockedFeature);
        })
      }
      type="button"
    >
      {required ? <ShieldCheck className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
      {required ? "Verification required before courier" : "Require verification before courier"}
    </button>
  );
}

export function VerificationPolicyNotice({ required }: { required: boolean }) {
  if (!required) {
    return null;
  }

  return (
    <p className="m-0 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        Courier booking is blocked for this store until an order is marked verified. Every order that
        has not been decided is listed below, not only the risky ones.
      </span>
    </p>
  );
}
