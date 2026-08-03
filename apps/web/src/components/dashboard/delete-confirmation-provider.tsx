"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type DeleteAction = (formData: FormData) => void | Promise<void>;

type DeleteConfirmationContextValue = {
  confirmDelete: (action: DeleteAction) => void;
};

const DeleteConfirmationContext = createContext<DeleteConfirmationContextValue | null>(null);

export function DeleteConfirmationProvider({ children }: { children: ReactNode }) {
  const [pendingAction, setPendingAction] = useState<DeleteAction | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = pendingAction !== null;

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !submitting) setPendingAction(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, submitting]);

  function closeDialog() {
    if (!submitting) {
      setPendingAction(null);
      setError(null);
    }
  }

  async function executeDelete() {
    if (!pendingAction || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await pendingAction(new FormData());
      setPendingAction(null);
    } catch (deleteError) {
      if (isRedirectError(deleteError)) {
        setPendingAction(null);
      } else {
        setError(deleteError instanceof Error ? deleteError.message : "This item could not be deleted.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <DeleteConfirmationContext.Provider
      value={{
        confirmDelete: (action) => {
          setError(null);
          setPendingAction(() => action);
        }
      }}
    >
      {children}
      {open ? (
        <div className="dashboard-modal-backdrop" onMouseDown={closeDialog}>
          <section
            aria-describedby="delete-confirmation-description"
            aria-labelledby="delete-confirmation-title"
            aria-modal="true"
            className="dashboard-confirm-dialog"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <h2 id="delete-confirmation-title">Delete Item</h2>
            <p id="delete-confirmation-description">Are you sure you want to delete this item?<br />This action cannot be undone.</p>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="dashboard-confirm-actions">
              <button className="dashboard-modal-cancel" disabled={submitting} onClick={closeDialog} type="button">Cancel</button>
              <button className="dashboard-modal-delete" disabled={submitting} onClick={executeDelete} type="button">
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </DeleteConfirmationContext.Provider>
  );
}

function isRedirectError(error: unknown) {
  return typeof (error as { digest?: unknown } | null)?.digest === "string" && String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT");
}

export function useDeleteConfirmation() {
  const context = useContext(DeleteConfirmationContext);

  if (!context) {
    throw new Error("DeleteConfirmationButton must be used inside DashboardShell.");
  }

  return context;
}
