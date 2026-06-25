"use client";

import { Button } from "@dash/ui";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import type { SaleActionState } from "../sale.actions";
import type { SalePaymentMethod, SaleStatus, SaleType } from "../sale.schema";

type ProductOption = {
  id: string;
  price: string;
  sku?: string | null;
  stockQuantity: number;
  title: string;
};

type CustomerOption = {
  email?: string | null;
  id: string;
  name: string;
  phone: string;
};

type SaleFormItem = {
  discount: string;
  id: string;
  productId: string;
  quantity: number;
  unitPrice: string;
};

export type SaleFormValue = {
  customerId?: string | null;
  discount?: string;
  items?: SaleFormItem[];
  notes?: string | null;
  paidAmount?: string;
  paymentMethod?: SalePaymentMethod;
  saleDate?: string;
  saleType?: SaleType;
  shipping?: string;
  status?: SaleStatus;
  tax?: string;
};

type SaleFormProps = {
  action: (state: SaleActionState, formData: FormData) => Promise<SaleActionState>;
  cancelHref: string;
  currency: string;
  customers: CustomerOption[];
  products: ProductOption[];
  sale?: SaleFormValue;
};

const initialState: SaleActionState = {
  status: "idle"
};

function emptyItem(): SaleFormItem {
  return {
    discount: "0.00",
    id: crypto.randomUUID(),
    productId: "",
    quantity: 1,
    unitPrice: "0.00"
  };
}

export function SaleForm({ action, cancelHref, currency, customers, products, sale }: SaleFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [items, setItems] = useState<SaleFormItem[]>(sale?.items?.length ? sale.items : [emptyItem()]);
  const [discount, setDiscount] = useState(sale?.discount ?? "0.00");
  const [tax, setTax] = useState(sale?.tax ?? "0.00");
  const [shipping, setShipping] = useState(sale?.shipping ?? "0.00");
  const [paidAmount, setPaidAmount] = useState(sale?.paidAmount ?? "0.00");
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const totals = useMemo(() => calculateTotals(items, discount, tax, shipping, paidAmount), [discount, items, paidAmount, shipping, tax]);

  function updateItem(id: string, patch: Partial<SaleFormItem>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  function selectProduct(id: string, productId: string) {
    const product = productMap.get(productId);
    updateItem(id, {
      productId,
      unitPrice: product?.price ?? "0.00"
    });
  }

  return (
    <form action={formAction} className="resource-form compact-form catalog-create-form">
      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="customerId">
          <label>
            Customer
            <select defaultValue={sale?.customerId ?? ""} name="customerId">
              <option value="">Walk-in / Guest customer</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name} - {customer.phone}
                </option>
              ))}
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="saleType">
          <label>
            Sale Type
            <select defaultValue={sale?.saleType ?? "OFFLINE"} name="saleType">
              <option value="OFFLINE">Offline</option>
              <option value="ONLINE">Online</option>
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="paymentMethod">
          <label>
            Payment Method
            <select defaultValue={sale?.paymentMethod ?? "CASH"} name="paymentMethod">
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="BKASH">bKash</option>
              <option value="NAGAD">Nagad</option>
              <option value="BANK">Bank</option>
              <option value="COD">COD</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="saleDate">
          <label>
            Sale Date
            <input defaultValue={sale?.saleDate ?? today()} name="saleDate" required type="date" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="status">
          <label>
            Status
            <select defaultValue={sale?.status ?? "DRAFT"} name="status">
              <option value="DRAFT">Draft</option>
              <option value="COMPLETED">Completed</option>
              <option value="CANCELLED">Cancelled</option>
              <option value="RETURNED">Returned</option>
            </select>
          </label>
        </FieldError>
      </div>

      <section className="rounded-xl border border-[#ececf5] bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ececf5] px-4 py-3">
          <h2 className="m-0 text-sm font-semibold">Products</h2>
          <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ddd6fe] px-3 text-xs font-semibold text-[#6d3cf5]" onClick={() => setItems((current) => [...current, emptyItem()])} type="button">
            <Plus className="h-3.5 w-3.5" /> Add Product
          </button>
        </header>
        <div className="overflow-x-auto p-4">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead className="bg-[#f7f7fa] text-[#565762]">
              <tr>
                <th className="rounded-l-lg p-3">Product</th>
                <th className="p-3">Stock</th>
                <th className="p-3">Qty</th>
                <th className="p-3">Unit Price</th>
                <th className="p-3">Discount</th>
                <th className="p-3">Line Total</th>
                <th className="rounded-r-lg p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const product = productMap.get(item.productId);

                return (
                  <tr className="border-b border-[#efeff5]" key={item.id}>
                    <td className="p-3">
                      <select name="productId" onChange={(event) => selectProduct(item.id, event.target.value)} required value={item.productId}>
                        <option value="">Select product</option>
                        {products.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.title}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3 text-[#686a76]">{product?.stockQuantity ?? "-"}</td>
                    <td className="p-3"><input min={1} name="quantity" onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 1 })} type="number" value={item.quantity} /></td>
                    <td className="p-3"><input min={0} name="unitPrice" onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} step="0.01" type="number" value={item.unitPrice} /></td>
                    <td className="p-3"><input min={0} name="itemDiscount" onChange={(event) => updateItem(item.id, { discount: event.target.value })} step="0.01" type="number" value={item.discount} /></td>
                    <td className="p-3 font-semibold">{formatMoney(lineTotal(item), currency)}</td>
                    <td className="p-3"><button className="inline-grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} type="button"><Trash2 className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <FieldError errors={state.fieldErrors} name="notes">
          <label>
            Notes
            <textarea defaultValue={sale?.notes ?? ""} name="notes" placeholder="Internal notes" rows={6} />
          </label>
        </FieldError>
        <section className="rounded-xl border border-[#ececf5] bg-[#faf9ff] p-4">
          <h2 className="m-0 text-sm font-semibold">Sale Summary</h2>
          <div className="mt-4 grid gap-3">
            <AmountInput label="Order Discount" name="discount" onChange={setDiscount} value={discount} />
            <AmountInput label="Tax" name="tax" onChange={setTax} value={tax} />
            <AmountInput label="Shipping" name="shipping" onChange={setShipping} value={shipping} />
            <AmountInput label="Paid Amount" name="paidAmount" onChange={setPaidAmount} value={paidAmount} />
            <SummaryRow label="Subtotal" value={formatMoney(totals.subtotal, currency)} />
            <SummaryRow label="Total" strong value={formatMoney(totals.total, currency)} />
            <SummaryRow label="Due" strong value={formatMoney(totals.due, currency)} />
          </div>
        </section>
      </div>

      <div className="form-actions">
        <Link className="catalog-cancel-button" href={cancelHref}>Cancel</Link>
        <Button className="catalog-submit-button" disabled={isPending} type="submit">{isPending ? "Saving..." : "Save Sale"}</Button>
      </div>
    </form>
  );
}

function AmountInput({ label, name, onChange, value }: { label: string; name: string; onChange: (value: string) => void; value: string }) {
  return <label className="grid gap-1.5 text-xs font-semibold text-[#565762]">{label}<input min={0} name={name} onChange={(event) => onChange(event.target.value)} step="0.01" type="number" value={value} /></label>;
}

function SummaryRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return <div className={`flex items-center justify-between border-t border-[#ececf5] pt-3 ${strong ? "text-base font-bold text-[#20212a]" : "text-sm text-[#686a76]"}`}><span>{label}</span><span>{value}</span></div>;
}

function FieldError({ children, errors, name }: { children: ReactNode; errors?: Record<string, string> | undefined; name: string }) {
  return <div className="field-shell">{children}{errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}</div>;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function lineTotal(item: SaleFormItem) {
  return Math.max((Number(item.unitPrice) || 0) * item.quantity - (Number(item.discount) || 0), 0);
}

function calculateTotals(items: SaleFormItem[], discount: string, tax: string, shipping: string, paid: string) {
  const subtotal = items.reduce((total, item) => total + lineTotal(item), 0);
  const total = Math.max(subtotal - (Number(discount) || 0) + (Number(tax) || 0) + (Number(shipping) || 0), 0);
  const paidAmount = Math.min(Number(paid) || 0, total);
  return { due: Math.max(total - paidAmount, 0), subtotal, total };
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(value);
}
