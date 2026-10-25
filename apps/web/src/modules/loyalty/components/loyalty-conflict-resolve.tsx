"use client";

import { useActionState } from "react";
import { resolveLoyaltyConflictAction, type LoyaltyMemberActionState } from "../loyalty.actions";

const idle: LoyaltyMemberActionState = { status: "idle" };

/** One conflict's "Mark resolved". The action re-checks role and store. */
export function LoyaltyConflictResolve({ conflictId }: { conflictId: string }) {
  const [state, action, pending] = useActionState(resolveLoyaltyConflictAction, idle);
  const resolved = state.status === "saved";

  return (
    <form action={action} className="grid gap-1">
      <input name="conflictId" type="hidden" value={conflictId} />
      <button
        className="font-semibold text-[#6d3cf5] disabled:opacity-70"
        disabled={pending || resolved}
        type="submit"
      >
        {resolved ? "Resolved" : pending ? "Saving..." : "Mark resolved"}
      </button>
      {state.status === "error" ? (
        <small className="text-xs text-rose-600">{state.message}</small>
      ) : null}
    </form>
  );
}
