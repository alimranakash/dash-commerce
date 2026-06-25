"use client";

import { Button } from "@dash/ui";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import type { PurchaseActionState } from "../purchase.actions";
import type { PurchaseStatus } from "../purchase.schema";

type SupplierOption = {
  id: string;
  label: string;
};

type ProductOption = {
  costPrice?: string | null;
  id: string;
  sku?: string | null;
  title: string;
};

type PurchaseFormItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  sku: string;
  unitCost: string;
};

export type PurchaseFormValue = {
  discountAmount?: string;
  items?: PurchaseFormItem[];
  notes?: string | null;
  paidAmount?: string;
  purchaseDate?: string;
  status?: PurchaseStatus;
  supplierId?: string;
  taxAmount?: string;
};

type PurchaseFormProps = {
  action: (state: PurchaseActionState, formData: FormData) => Promise<PurchaseActionState>;
  cancelHref: string;
  currency: string;
  products: ProductOption[];
  purchase?: PurchaseFormValue;
  suppliers: SupplierOption[];
};

const initialState: PurchaseActionState = {
  status: "idle"
};

function emptyItem(): PurchaseFormItem {
  return {
    id: crypto.randomUUID(),
    productId: "",
    productName: "",
    quantity: 1,
    sku: "",
    unitCost: "0.00"
  };
}

export function PurchaseForm({ action, cancelHref, currency, products, purchase, suppliers }: PurchaseFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [items, setItems] = useState<PurchaseFormItem[]>(purchase?.items?.length ? purchase.items : [emptyItem()]);
  const [discount, setDiscount] = useState(purchase?.discountAmount ?? "0.00");
  const [tax, setTax] = useState(purchase?.taxAmount ?? "0.00");
  const [paid, setPaid] = useState(purchase?.paidAmount ?? "0.00");
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const totals = useMemo(() => calculateTotals(items, discount, tax, paid), [discount, items, paid, tax]);

  function updateItem(id: string, patch: Partial<PurchaseFormItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function selectProduct(id: string, productId: string) {
    const product = productMap.get(productId);

    updateItem(id, {
      productId,
      productName: product?.title ?? "",
      sku: product?.sku ?? "",
      unitCost: product?.costPrice ?? "0.00"
    });
  }

  return (
    <form action={formAction} className="resource-form compact-form catalog-create-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="supplierId">
          <label>
            Supplier
            <select defaultValue={purchase?.supplierId ?? ""} name="supplierId" required>
              <option value="">Select supplier</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.label}
                </option>
              ))}
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="purchaseDate">
          <label>
            Purchase Date
            <input defaultValue={purchase?.purchaseDate ?? today()} name="purchaseDate" required type="date" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="status">
          <label>
            Status
            <select defaultValue={purchase?.status ?? "DRAFT"} name="status">
              <option value="DRAFT">Draft</option>
              <option value="ORDERED">Ordered</option>
              <option value="RECEIVED">Received</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>
        </FieldError>
      </div>

      <section className="rounded-xl border border-[#ececf5] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ececf5] px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">Purchase Items</h2>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ddd6fe] px-3 text-xs font-semibold text-[#6d3cf5]" onClick={() => setItems((current) => [...current, emptyItem()])} type="button">
            <Plus className="h-3.5 w-3.5" /> Add Item
          </button>
        </header>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[900px] border-collapse text-left text-xs">
            <thead className="bg-[#f7f7fa] text-[#565762]">
              <tr>
                <th className="rounded-l-lg p-3 font-semibold">Product</th>
                <th className="p-3 font-semibold">Manual Name</th>
                <th className="p-3 font-semibold">SKU</th>
                <th className="p-3 font-semibold">Qty</th>
                <th className="p-3 font-semibold">Unit Cost</th>
                <th className="p-3 font-semibold">Line Total</th>
                <th className="rounded-r-lg p-3 font-semibold">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="border-b border-[#efeff5]" key={item.id}>
                  <td className="p-3">
                    <select name="productId" onChange={(event) => selectProduct(item.id, event.target.value)} value={item.productId}>
                      <option value="">Manual item</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.title}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-3">
                    <input name="productName" onChange={(event) => updateItem(item.id, { productName: event.target.value })} placeholder="Product name" type="text" value={item.productName} />
                  </td>
                  <td className="p-3">
                    <input name="sku" onChange={(event) => updateItem(item.id, { sku: event.target.value })} placeholder="SKU" type="text" value={item.sku} />
                  </td>
                  <td className="p-3">
                    <input min={1} name="quantity" onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 1 })} type="number" value={item.quantity} />
                  </td>
                  <td className="p-3">
                    <input min={0} name="unitCost" onChange={(event) => updateItem(item.id, { unitCost: event.target.value })} step="0.01" type="number" value={item.unitCost} />
                  </td>
                  <td className="p-3 font-semibold">{formatMoney(lineTotal(item), currency)}</td>
                  <td className="p-3">
                    <button className="inline-grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} type="button">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <FieldError errors={state.fieldErrors} name="notes">
          <label>
            Notes
            <textarea defaultValue={purchase?.notes ?? ""} name="notes" placeholder="Internal notes for this purchase" rows={6} />
          </label>
        </FieldError>
        <section className="rounded-xl border border-[#ececf5] bg-[#faf9ff] p-4">
          <h2 className="m-0 text-sm font-semibold">Payment Summary</h2>
          <div className="mt-4 grid gap-3">
            <AmountInput label="Discount" name="discountAmount" onChange={setDiscount} value={discount} />
            <AmountInput label="Tax" name="taxAmount" onChange={setTax} value={tax} />
            <AmountInput label="Paid Amount" name="paidAmount" onChange={setPaid} value={paid} />
            <SummaryRow label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
            <SummaryRow label="Total" strong value={formatMoney(totals.total, currency)} />
            <SummaryRow label="Due" strong value={formatMoney(totals.due, currency)} />
          </div>
        </section>
      </div>

      <div className="form-actions">
        <Link className="catalog-cancel-button" href={cancelHref}>
          Cancel
        </Link>
        <Button className="catalog-submit-button" disabled={isPending} type="submit">
          {isPending ? "Saving..." : "Save Purchase"}
        </Button>
      </div>
    </form>
  );
}

function AmountInput({ label, name, onChange, value }: { label: string; name: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold text-[#565762]">
      {label}
      <input min={0} name={name} onChange={(event) => onChange(event.target.value)} step="0.01" type="number" value={value} />
    </label>
  );
}

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className={`flex items-center justify-between border-t border-[#ececf5] pt-3 ${strong ? "text-base font-bold text-[#20212a]" : "text-sm text-[#686a76]"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
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
  return new Date().toISOString().slice(0, 10);
}

function lineTotal(item: PurchaseFormItem) {
  return (Number(item.unitCost) || 0) * item.quantity;
}

function calculateTotals(items: PurchaseFormItem[], discount: string, tax: string, paid: string) {
  const subtotal = items.reduce((total, item) => total + lineTotal(item), 0);
  const total = Math.max(subtotal - (Number(discount) || 0) + (Number(tax) || 0), 0);
  const paidAmount = Math.min(Number(paid) || 0, total);

  return {
    due: Math.max(total - paidAmount, 0),
    subtotal,
    total
  };
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}
