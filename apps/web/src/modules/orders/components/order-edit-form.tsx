"use client";

import { Button } from "@dash/ui";
import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import type { OrderDetailsActionState } from "../order.actions";

export type OrderEditFormValue = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  area?: string | null;
  city?: string | null;
  country?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  district?: string | null;
  notes?: string | null;
  postalCode?: string | null;
};

type OrderEditFormProps = {
  action: (state: OrderDetailsActionState, formData: FormData) => Promise<OrderDetailsActionState>;
  cancelHref: string;
  /** Set once the order is with a carrier: the booking keeps the old address. */
  bookedWarning?: string | undefined;
  order: OrderEditFormValue;
};

const initialState: OrderDetailsActionState = {
  status: "idle"
};

export function OrderEditForm({ action, bookedWarning, cancelHref, order }: OrderEditFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="resource-form compact-form catalog-create-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      {bookedWarning ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          {bookedWarning}
        </p>
      ) : null}

      <h2 className="m-0 text-sm font-semibold text-[#292a34]">Customer</h2>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="customerName">
          <label>
            Customer Name
            <input
              defaultValue={order.customerName ?? ""}
              name="customerName"
              placeholder="Full name"
              required
              type="text"
            />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="customerPhone">
          <label>
            Phone
            <input
              defaultValue={order.customerPhone ?? ""}
              name="customerPhone"
              placeholder="01XXXXXXXXX"
              required
              type="tel"
            />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="customerEmail">
          <label>
            Email
            <input
              defaultValue={order.customerEmail ?? ""}
              name="customerEmail"
              placeholder="customer@example.com"
              type="email"
            />
          </label>
        </FieldError>
      </div>

      <h2 className="m-0 mt-2 text-sm font-semibold text-[#292a34]">Delivery Address</h2>
      <FieldError errors={state.fieldErrors} name="addressLine1">
        <label>
          Address
          <textarea
            defaultValue={order.addressLine1 ?? ""}
            name="addressLine1"
            placeholder="House, road, landmark"
            required
            rows={3}
          />
        </label>
      </FieldError>
      <FieldError errors={state.fieldErrors} name="addressLine2">
        <label>
          Address Line 2
          <input
            defaultValue={order.addressLine2 ?? ""}
            name="addressLine2"
            placeholder="Optional"
            type="text"
          />
        </label>
      </FieldError>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="area">
          <label>
            Area
            <input defaultValue={order.area ?? ""} name="area" placeholder="Area" type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="city">
          <label>
            City
            <input defaultValue={order.city ?? ""} name="city" placeholder="City" type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="district">
          <label>
            District
            <input
              defaultValue={order.district ?? ""}
              name="district"
              placeholder="District"
              required
              type="text"
            />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="postalCode">
          <label>
            Postal Code
            <input
              defaultValue={order.postalCode ?? ""}
              name="postalCode"
              placeholder="Optional"
              type="text"
            />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="country">
          <label>
            Country
            <input
              defaultValue={order.country ?? "Bangladesh"}
              name="country"
              placeholder="Bangladesh"
              required
              type="text"
            />
          </label>
        </FieldError>
      </div>

      <FieldError errors={state.fieldErrors} name="notes">
        <label>
          Order Note
          <textarea
            defaultValue={order.notes ?? ""}
            name="notes"
            placeholder="Delivery instructions for this order"
            rows={4}
          />
        </label>
      </FieldError>

      <div className="form-actions">
        <Link className="catalog-cancel-button" href={cancelHref}>
          Cancel
        </Link>
        <Button className="catalog-submit-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save Changes"}
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
