"use client";

import { useTransition, type ReactNode } from "react";
import { useUpgradePrompt } from "./plan-upgrade-provider";
import type { GatedResult } from "../plan-features";

/**
 * Button for a gated server action, usable from a server component.
 *
 * `<form action={gatedAction}>` cannot work here: a form action must resolve to
 * void, and it gives the page no way to react to a `lockedFeature` result. This
 * awaits the action instead and hands any lock to the shared upgrade dialog.
 */
export function GatedActionButton({
  action,
  children,
  className
}: {
  action: () => Promise<GatedResult>;
  children: ReactNode;
  className?: string | undefined;
}) {
  const { openUpgrade } = useUpgradePrompt();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      className={className}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          openUpgrade((await action()).lockedFeature);
        })
      }
      type="button"
    >
      {children}
    </button>
  );
}
