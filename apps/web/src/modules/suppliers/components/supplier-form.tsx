"use client";

import { Button } from "@dash/ui";
import { useActionState, type ReactNode } from "react";
import type { SupplierActionState } from "../supplier.actions";
import type { SupplierStatus } from "../supplier.schema";

export type SupplierFormValue = {
  address?: string | null;
  companyName?: string | null;
  email?: string | null;
  name?: string | null;
  notes?: string | null;
  phone?: string | null;
  status?: SupplierStatus;
};

type SupplierFormProps = {
  action: (state: SupplierActionState, formData: FormData) => Promise<SupplierActionState>;
  cancelHref?: string;
  supplier?: SupplierFormValue;
  submitLabel: string;
};

const initialState: SupplierActionState = {
  status: "idle"
};

export function SupplierForm({ action, cancelHref, supplier, submitLabel }: SupplierFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form compact-form catalog-create-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}

      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="name">
          <label>
            Name
            <input defaultValue={supplier?.name ?? ""} name="name" placeholder="Supplier name" required type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="companyName">
          <label>
            Company Name
            <input defaultValue={supplier?.companyName ?? ""} name="companyName" placeholder="Company name" type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="phone">
          <label>
            Phone
            <input defaultValue={supplier?.phone ?? ""} name="phone" placeholder="+880..." required type="tel" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="email">
          <label>
            Email
            <input defaultValue={supplier?.email ?? ""} name="email" placeholder="supplier@example.com" type="email" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="status">
          <label>
            Status
            <select defaultValue={supplier?.status ?? "ACTIVE"} name="status">
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        </FieldError>
      </div>

      <FieldError errors={state.fieldErrors} name="address">
        <label>
          Address
          <textarea defaultValue={supplier?.address ?? ""} name="address" placeholder="Supplier address" rows={4} />
        </label>
      </FieldError>
      <FieldError errors={state.fieldErrors} name="notes">
        <label>
          Notes
          <textarea defaultValue={supplier?.notes ?? ""} name="notes" placeholder="Internal notes" rows={5} />
        </label>
      </FieldError>

      <div className="form-actions">
        {cancelHref ? (
          <a className="catalog-cancel-button" href={cancelHref}>
            Cancel
          </a>
        ) : null}
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
