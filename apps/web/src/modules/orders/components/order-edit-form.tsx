"use client";

import { Button } from "@dash/ui";
import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import type { OrderDetailsActionState } from "../order.actions";
import type { OrderFormProductOption } from "./order-create-form";

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
  /** What the order is currently for, as the picker below works in. */
  lines: OrderEditLine[];
};

export type OrderEditLine = {
  price: string;
  productId: string;
  quantity: number;
  title: string;
  variantId: string | null;
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
  /**
   * Why the products are read-only, when they are. The carrier is holding a
   * label with an amount on it, or a return has been filed against these exact
   * lines — either way the basket is no longer only ours to change.
   */
  itemsLockedReason?: string | undefined;
  order: OrderEditFormValue;
  paymentMethods: OrderEditPaymentOption[];
  products: OrderFormProductOption[];
};

const initialState: OrderDetailsActionState = {
  status: "idle"
};

export function OrderEditForm({
  action,
  bookedWarning,
  cancelHref,
  currency,
  itemsLockedReason,
  order,
  paymentMethods,
  products
}: OrderEditFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [lines, setLines] = useState<OrderEditLine[]>(order.lines);
  const [search, setSearch] = useState("");
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});
  const [shippingAmount, setShippingAmount] = useState(order.shippingAmount ?? "0.00");
  const [discountAmount, setDiscountAmount] = useState(order.discountAmount ?? "0.00");
  const [paymentMethod, setPaymentMethod] = useState(
    order.paymentMethod ?? paymentMethods[0]?.type ?? "COD"
  );
  const editable = !itemsLockedReason;
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scoped = query
      ? products.filter(
          (product) =>
            product.title.toLowerCase().includes(query) ||
            (product.sku ?? "").toLowerCase().includes(query)
        )
      : products;

    // A picker, not a catalog: a large store's whole list would bury the box.
    return scoped.slice(0, 40);
  }, [products, search]);
  const subtotal = lines.reduce((sum, line) => sum + Number(line.price || 0) * line.quantity, 0);

  function addLine(product: OrderFormProductOption) {
    const variantId = product.variants.length
      ? (variantChoice[product.id] ?? product.variants[0]?.id ?? null)
      : null;
    const variant = product.variants.find((entry) => entry.id === variantId) ?? null;

    if (product.variants.length && !variant) {
      return;
    }

    setLines((current) => {
      const existing = current.find(
        (line) => line.productId === product.id && line.variantId === (variant?.id ?? null)
      );

      // The same option twice means one more of it, not a second row.
      if (existing) {
        return current.map((line) =>
          line === existing ? { ...line, quantity: line.quantity + 1 } : line
        );
      }

      return [
        ...current,
        {
          price: Number(variant ? variant.price : product.price).toFixed(2),
          productId: product.id,
          quantity: 1,
          title: variant ? `${product.title} - ${variant.title}` : product.title,
          variantId: variant?.id ?? null
        }
      ];
    });
  }

  function updateLine(index: number, patch: Partial<OrderEditLine>) {
    setLines((current) =>
      current.map((line, position) => (position === index ? { ...line, ...patch } : line))
    );
  }

  function removeLine(index: number) {
    setLines((current) => current.filter((_, position) => position !== index));
  }
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

      {/*
        Only posted when the products are the seller's to change. Absent tells
        the server to leave the basket exactly as it is, which is what keeps a
        booked order's address correctable.
      */}
      {editable ? (
        <input
          name="items"
          type="hidden"
          value={JSON.stringify(
            lines.map((line) => ({
              price: line.price,
              productId: line.productId,
              quantity: line.quantity,
              variantId: line.variantId ?? undefined
            }))
          )}
        />
      ) : null}

      <h2 className="m-0 text-sm font-semibold text-[#292a34]">Products</h2>
      {state.fieldErrors?.items ? (
        <span className="field-error">{state.fieldErrors.items}</span>
      ) : null}
      {itemsLockedReason ? (
        <p className="m-0 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-800">
          {itemsLockedReason}
        </p>
      ) : (
        <div className="rounded-lg border border-[#ececf5] bg-[#fbfbfe] p-3">
          <input
            className="w-full"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search products by name or SKU"
            type="search"
            value={search}
          />
          <div className="mt-3 max-h-64 overflow-y-auto">
            {matches.length === 0 ? (
              <p className="m-0 px-1 py-4 text-center text-xs text-[#7b7c92]">
                No products match that search.
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {matches.map((product) => (
                  <li
                    className="flex flex-wrap items-center gap-3 rounded-lg bg-white px-3 py-2"
                    key={product.id}
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-[#292a34]">
                        {product.title}
                      </span>
                      <span className="text-xs text-[#7b7c92]">
                        {formatMoney(Number(product.price), currency)} · {product.stockQuantity} in
                        stock
                      </span>
                    </span>
                    {product.variants.length ? (
                      <select
                        onChange={(event) =>
                          setVariantChoice((current) => ({
                            ...current,
                            [product.id]: event.target.value
                          }))
                        }
                        value={variantChoice[product.id] ?? product.variants[0]?.id ?? ""}
                      >
                        {product.variants.map((variant) => (
                          <option key={variant.id} value={variant.id}>
                            {variant.title} ({variant.stockQuantity})
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      className="rounded-lg border border-[#d9d8ea] bg-white px-3 py-1.5 text-xs font-semibold text-[#4b3fd6]"
                      onClick={() => addLine(product)}
                      type="button"
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {lines.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-[#d9d8ea] px-4 py-6 text-center text-xs text-[#7b7c92]">
          This order has no products. Add at least one before saving.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#7b7c92]">
                <th className="py-2 pr-3 font-semibold">Product</th>
                <th className="py-2 pr-3 font-semibold">Unit price</th>
                <th className="py-2 pr-3 font-semibold">Qty</th>
                <th className="py-2 pr-3 text-right font-semibold">Total</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr className="border-t border-[#ececf5]" key={`${line.productId}::${line.variantId ?? ""}::${index}`}>
                  <td className="py-2 pr-3">
                    <span className="block text-sm font-medium text-[#292a34]">{line.title}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-24"
                      disabled={!editable}
                      inputMode="decimal"
                      onChange={(event) => updateLine(index, { price: event.target.value })}
                      type="text"
                      value={line.price}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-20"
                      disabled={!editable}
                      min={1}
                      onChange={(event) =>
                        updateLine(index, {
                          quantity: Math.max(1, Number(event.target.value) || 1)
                        })
                      }
                      type="number"
                      value={line.quantity}
                    />
                  </td>
                  <td className="py-2 pr-3 text-right text-sm font-medium text-[#292a34]">
                    {formatMoney(Number(line.price || 0) * line.quantity, currency)}
                  </td>
                  <td className="py-2 text-right">
                    {editable ? (
                      <button
                        className="text-xs font-semibold text-[#c0392b]"
                        onClick={() => removeLine(index)}
                        type="button"
                      >
                        Remove
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="m-0 mt-2 text-sm font-semibold text-[#292a34]">Customer</h2>
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
        <SummaryRow label="Products" value={formatMoney(subtotal, currency)} />
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
        <Button
          className="catalog-submit-button"
          disabled={isPending || lines.length === 0}
          type="submit"
        >
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
