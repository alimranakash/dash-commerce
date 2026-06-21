"use client";

import type { ReactNode } from "react";
import { useDeleteConfirmation } from "./delete-confirmation-provider";

type DeleteConfirmationButtonProps = {
  action: (formData: FormData) => void | Promise<void>;
  ariaLabel: string;
  children: ReactNode;
  className?: string;
  title?: string;
};

export function DeleteConfirmationButton({ action, ariaLabel, children, className, title }: DeleteConfirmationButtonProps) {
  const { confirmDelete } = useDeleteConfirmation();

  return (
    <button aria-label={ariaLabel} className={className} onClick={() => confirmDelete(action)} title={title} type="button">
      {children}
    </button>
  );
}
