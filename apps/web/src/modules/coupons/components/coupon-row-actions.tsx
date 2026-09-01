"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import { deleteCouponAction, setCouponStatusAction } from "../coupon.actions";
import type { CouponStatus } from "../coupon.schema";

type CouponRowActionsProps = {
  code: string;
  couponId: string;
  status: CouponStatus;
};

export function CouponRowActions({ code, couponId, status }: CouponRowActionsProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { openUpgrade } = useUpgradePrompt();

  function toggleStatus() {
    setError(null);
    startTransition(async () => {
      const result = await setCouponStatusAction(
        couponId,
        status === "ACTIVE" ? "INACTIVE" : "ACTIVE"
      );

      // Re-activating is authoring, so an unentitled store is refused here and
      // gets the upgrade dialog. Deactivating is never gated — see the action.
      if (result.lockedFeature) {
        openUpgrade(result.lockedFeature);
        return;
      }

      if (result.status === "error") {
        setError(result.message ?? "Coupon status could not be changed.");
      }
    });
  }

  function remove() {
    // A used coupon is refused by the service with an explanation; this only
    // guards against the accidental click.
    if (!window.confirm(`Delete coupon ${code}? This cannot be undone.`)) {
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await deleteCouponAction(couponId);

      // A successful delete redirects and never returns, so anything that comes
      // back is a refusal worth showing.
      if (result?.status === "error") {
        setError(result.message ?? "Coupon could not be deleted.");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center justify-end gap-1.5">
        <button
          className="rounded-md border border-[#e5e3f1] px-2.5 py-1.5 text-xs font-medium text-[#555762] transition hover:bg-[#f7f7fb] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={toggleStatus}
          type="button"
        >
          {status === "ACTIVE" ? "Deactivate" : "Activate"}
        </button>
        <Link
          aria-label={`Edit coupon ${code}`}
          className="grid h-8 w-8 place-items-center rounded-md border border-[#e5e3f1] text-[#555762] transition hover:bg-[#f7f7fb]"
          href={`/dashboard/coupons/${couponId}`}
        >
          <Pencil aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
        <button
          aria-label={`Delete coupon ${code}`}
          className="grid h-8 w-8 place-items-center rounded-md border border-[#f5c9d0] text-[#f05268] transition hover:bg-[#fdf2f4] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={pending}
          onClick={remove}
          type="button"
        >
          {pending ? (
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Trash2 aria-hidden="true" className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      {error ? (
        <p aria-live="polite" className="m-0 max-w-xs text-right text-xs text-[#b3273f]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
