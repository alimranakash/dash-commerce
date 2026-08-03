"use client";

import { Button } from "@dash/ui";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import type { ExpenseActionState } from "../expense.actions";
import type { ExpensePaymentMethod, ExpenseStatus } from "../expense.schema";

export type ExpenseCategoryOption = {
  color: string;
  id: string;
  name: string;
};

export type ExpenseFormValue = {
  amount?: string;
  attachmentUrl?: string | null;
  categoryId?: string;
  expenseDate?: string;
  notes?: string | null;
  paymentMethod?: ExpensePaymentMethod;
  reference?: string | null;
  status?: ExpenseStatus;
  title?: string;
};

type ExpenseFormProps = {
  action: (state: ExpenseActionState, formData: FormData) => Promise<ExpenseActionState>;
  cancelHref: string;
  categories: ExpenseCategoryOption[];
  expense?: ExpenseFormValue;
};

const initialState: ExpenseActionState = {
  status: "idle"
};

export function ExpenseForm({ action, cancelHref, categories, expense }: ExpenseFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form compact-form catalog-create-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="title">
          <label>
            Title
            <input defaultValue={expense?.title ?? ""} name="title" placeholder="Expense title" required type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="categoryId">
          <label>
            Category
            <select defaultValue={expense?.categoryId ?? ""} name="categoryId" required>
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="amount">
          <label>
            Amount
            <input defaultValue={expense?.amount ?? ""} min={0} name="amount" placeholder="0.00" required step="0.01" type="number" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="paymentMethod">
          <label>
            Payment Method
            <select defaultValue={expense?.paymentMethod ?? "CASH"} name="paymentMethod">
              <option value="CASH">Cash</option>
              <option value="BANK">Bank</option>
              <option value="BKASH">bKash</option>
              <option value="NAGAD">Nagad</option>
              <option value="CARD">Card</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="expenseDate">
          <label>
            Expense Date
            <input defaultValue={expense?.expenseDate ?? today()} name="expenseDate" required type="date" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="status">
          <label>
            Status
            <select defaultValue={expense?.status ?? "PENDING"} name="status">
              <option value="PENDING">Pending</option>
              <option value="PAID">Paid</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="reference">
          <label>
            Reference
            <input defaultValue={expense?.reference ?? ""} name="reference" placeholder="Receipt, transaction ID, invoice no." type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="attachmentUrl">
          <label>
            Attachment URL
            <input defaultValue={expense?.attachmentUrl ?? ""} name="attachmentUrl" placeholder="https://..." type="url" />
          </label>
        </FieldError>
      </div>
      <FieldError errors={state.fieldErrors} name="notes">
        <label>
          Notes
          <textarea defaultValue={expense?.notes ?? ""} name="notes" placeholder="Internal notes" rows={5} />
        </label>
      </FieldError>
      <p className="catalog-placeholder-message">Attachment upload can be connected to the existing media system later; URL storage is available now.</p>
      <div className="form-actions">
        <Link className="catalog-cancel-button" href={cancelHref}>
          Cancel
        </Link>
        <Button className="catalog-submit-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save Expense"}
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

function today() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
