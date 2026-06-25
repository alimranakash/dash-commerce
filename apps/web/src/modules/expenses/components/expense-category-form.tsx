"use client";

import { Button } from "@dash/ui";
import { useActionState, type ReactNode } from "react";
import type { ExpenseActionState } from "../expense.actions";

type ExpenseCategoryFormProps = {
  action: (state: ExpenseActionState, formData: FormData) => Promise<ExpenseActionState>;
  category?: {
    color: string;
    icon: string;
    name: string;
  };
  submitLabel: string;
};

const initialState: ExpenseActionState = {
  status: "idle"
};

export function ExpenseCategoryForm({ action, category, submitLabel }: ExpenseCategoryFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form compact-form catalog-create-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <FieldError errors={state.fieldErrors} name="name">
        <label>
          Name
          <input defaultValue={category?.name ?? ""} name="name" placeholder="Category name" required type="text" />
        </label>
      </FieldError>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="color">
          <label>
            Color
            <input defaultValue={category?.color ?? "#7C3AED"} name="color" type="color" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="icon">
          <label>
            Icon
            <input defaultValue={category?.icon ?? "receipt"} name="icon" placeholder="receipt" type="text" />
          </label>
        </FieldError>
      </div>
      <div className="form-actions">
        <Button className="catalog-submit-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function FieldError({
  children,
  errors,
  name
}: {
  children: ReactNode;
  errors?: Record<string, string> | undefined;
  name: string;
}) {
  return (
    <div className="field-shell">
      {children}
      {errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}
    </div>
  );
}
