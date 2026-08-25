"use client";

import { Button } from "@dash/ui";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
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
  discountAmount?: string | null;
  district?: string | null;
  notes?: string | null;
  paymentMethod?: string | null;
  paymentNote?: string | null;
  paymentReference?: string | null;
  postalCode?: string | null;
  shippingAmount?: string | null;
  /** The lines' total. Shown, never edited: changing it means moving stock. */
  subtotalAmount: string;
};

export type OrderEditPaymentOption = {
  isEnabled: boolean;
  name: string;
  type: string;
};

type OrderEditFormProps = {
  action: (state: OrderDetailsActionState, formData: FormData) => Promise<OrderDetailsActionState>;
  cancelHref: string;
  /** Set once the order is with a carrier: the booking keeps the old address. */
  bookedWarning?: string | undefined;
  currency: string;
  order: OrderEditFormValue;
  paymentMethods: OrderEditPaymentOption[];
};

const initialState: OrderDetailsActionState = {
  status: "idle"
};

export function OrderEditForm({
  action,
  bookedWarning,
  cancelHref,
  currency,
  order,
  paymentMethods
}: OrderEditFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [shippingAmount, setShippingAmount] = useState(order.shippingAmount ?? "0.00");
  const [discountAmount, setDiscountAmount] = useState(order.discountAmount ?? "0.00");
  const [paymentMethod, setPaymentMethod] = useState(
    order.paymentMethod ?? paymentMethods[0]?.type ?? "COD"
  );
  const subtotal = Number(order.subtotalAmount) || 0;
  const total = subtotal + (Number(shippingAmount) || 0) - (Number(discountAmount) || 0);
  // Same rule as the create form: the reference only means something on a
  // method that has one to quote.
  const needsPaymentReference = paymentMethod !== "COD";

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

      <h2 className="m-0 mt-2 text-sm font-semibold text-[#292a34]">Charges</h2>
      {/*
        The subtotal is the sum of this order's products, so it is read-only
        here — changing what was bought means putting stock back and taking it
        out again, which this form does not do.
      */}
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="shippingAmount">
          <label>
            Delivery Charge
            <input
              inputMode="decimal"
              name="shippingAmount"
              onChange={(event) => setShippingAmount(event.target.value)}
              type="text"
              value={shippingAmount}
            />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="discountAmount">
          <label>
            Discount
            <input
              inputMode="decimal"
              name="discountAmount"
              onChange={(event) => setDiscountAmount(event.target.value)}
              type="text"
              value={discountAmount}
            />
          </label>
        </FieldError>
      </div>

      <dl className="m-0 rounded-lg border border-[#ececf5] bg-[#fbfbfe] px-4 py-3 text-sm">
        <SummaryRow label="Products (not editable here)" value={formatMoney(subtotal, currency)} />
        <SummaryRow label="Delivery" value={formatMoney(Number(shippingAmount) || 0, currency)} />
        <SummaryRow
          label="Discount"
          value={`- ${formatMoney(Number(discountAmount) || 0, currency)}`}
        />
        <div className="mt-2 flex items-center justify-between border-t border-[#ececf5] pt-2 text-base font-semibold text-[#292a34]">
          <dt>Total</dt>
          <dd className="m-0">{formatMoney(total, currency)}</dd>
        </div>
      </dl>

      <h2 className="m-0 mt-2 text-sm font-semibold text-[#292a34]">Payment</h2>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="paymentMethod">
          <label>
            Payment Method
            <select
              name="paymentMethod"
              onChange={(event) => setPaymentMethod(event.target.value)}
              value={paymentMethod}
            >
              {paymentMethods.map((method) => (
                <option key={method.type} value={method.type}>
                  {method.name}
                  {method.isEnabled ? "" : " (off at checkout)"}
                </option>
              ))}
            </select>
          </label>
        </FieldError>
        {needsPaymentReference ? (
          <FieldError errors={state.fieldErrors} name="paymentReference">
            <label>
              Transaction ID
              <input
                defaultValue={order.paymentReference ?? ""}
                name="paymentReference"
                placeholder="bKash / Nagad trx id"
                type="text"
              />
            </label>
          </FieldError>
        ) : null}
        <FieldError errors={state.fieldErrors} name="paymentNote">
          <label>
            Payment Note
            <input
              defaultValue={order.paymentNote ?? ""}
              name="paymentNote"
              placeholder="Optional"
              type="text"
            />
          </label>
        </FieldError>
      </div>

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

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[#4b4c5f]">
      <dt>{label}</dt>
      <dd className="m-0">{value}</dd>
    </div>
  );
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value || 0);
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
