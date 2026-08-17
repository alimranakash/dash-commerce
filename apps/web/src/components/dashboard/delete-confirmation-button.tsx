"use client";

import type { ReactNode } from "react";
import { useUpgradePrompt } from "../../modules/billing/components/plan-upgrade-provider";
import { useDeleteConfirmation } from "./delete-confirmation-provider";
import type { GatedResult } from "../../modules/billing/plan-features";

type DeleteConfirmationButtonProps = {
  action: (formData: FormData) => GatedResult | void | Promise<GatedResult | void>;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  title?: string;
};

export function DeleteConfirmationButton({ action, ariaLabel, children, className, title }: DeleteConfirmationButtonProps) {
  const { confirmDelete } = useDeleteConfirmation();
  const { openUpgrade } = useUpgradePrompt();

  /**
   * Gated destructive actions return `lockedFeature` instead of doing the work,
   * so the confirmation flow turns that into the upgrade dialog rather than
   * silently appearing to succeed.
   */
  async function run(formData: FormData) {
    const result = await action(formData);

    openUpgrade(result?.lockedFeature);
  }

  return (
    <button aria-label={ariaLabel} className={className} onClick={() => confirmDelete(run)} title={title} type="button">
      {children}
    </button>
  );
}
