"use client";

import { useTransition } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import type { GatedResult } from "../../billing/plan-features";
import {
  blockCustomerAndRedirectAction,
  blockCustomerAction,
  markOrderFakeAction,
  markOrderFakeAndRedirectAction,
  markOrderVerifiedAction,
  markOrderVerifiedAndRedirectAction,
  returnToNormalQueueAction,
  returnToNormalQueueAndRedirectAction
} from "../fake-order.actions";

type FakeOrderActionButtonsProps = {
  compact?: boolean;
  orderId: string;
  redirectToQueue?: boolean;
};

export function FakeOrderActionButtons({ compact = false, orderId, redirectToQueue = false }: FakeOrderActionButtonsProps) {
  const verifiedAction = redirectToQueue ? markOrderVerifiedAndRedirectAction : markOrderVerifiedAction;
  const fakeAction = redirectToQueue ? markOrderFakeAndRedirectAction : markOrderFakeAction;
  const blockAction = redirectToQueue ? blockCustomerAndRedirectAction : blockCustomerAction;
  const normalAction = redirectToQueue ? returnToNormalQueueAndRedirectAction : returnToNormalQueueAction;

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "justify-end" : ""}`}>
      <ActionForm action={verifiedAction.bind(null, orderId)} label="Mark Verified" tone="green" />
      <ActionForm action={fakeAction.bind(null, orderId)} label="Mark Fake" tone="red" />
      <ActionForm action={blockAction.bind(null, orderId)} label="Block Customer" tone="red" />
      <ActionForm action={normalAction.bind(null, orderId)} label="Return to Normal Queue" tone="purple" />
    </div>
  );
}

function ActionForm({ action, label, tone }: { action: () => Promise<GatedResult>; label: string; tone: "green" | "purple" | "red" }) {
  const { openUpgrade } = useUpgradePrompt();
  const [isPending, startTransition] = useTransition();
  const toneClass = {
    green: "border-emerald-200 text-emerald-700 hover:bg-emerald-50",
    purple: "border-[#ddd6fe] text-[#6d3cf5] hover:bg-[#f3f0ff]",
    red: "border-red-200 text-red-700 hover:bg-red-50"
  }[tone];

  // A button rather than a form action, so a plan-blocked result can open the
  // upgrade dialog instead of the click silently doing nothing.
  return (
    <button
      className={`h-8 rounded-lg border px-3 text-[11px] font-semibold transition disabled:opacity-60 ${toneClass}`}
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          openUpgrade((await action()).lockedFeature);
        })
      }
      type="button"
    >
      {label}
    </button>
  );
}
