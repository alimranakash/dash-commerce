"use client";

import { Button } from "@dash/ui";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import type { SaleActionState } from "../sale.actions";
import type { SaleCustomerOption } from "../sale-customer";
import {
  buildSaleScanCatalogue,
  emptySaleLine,
  formatSaleMoney,
  ringUpScan,
  stockHeldBySale,
  type SaleLine,
  type SaleProductOption
} from "../sale-scan";
import type { SalePaymentMethod, SaleStatus, SaleType } from "../sale.schema";
import { SaleCustomerPicker } from "./sale-customer-picker";
import { SaleScanBox, type SaleScanOrigin } from "./sale-scan-box";

export type SaleFormValue = {
  customerId?: string | null;
  discount?: string;
  items?: SaleLine[];
  /** The sale's current customer opted in to earn on it — read on the server. */
  loyaltyOptedIn?: boolean;
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
  customers: SaleCustomerOption[];
  /** Whether the store's loyalty programme is running — see `SaleCustomerPicker`. */
  loyaltyLive: boolean;
  products: SaleProductOption[];
  sale?: SaleFormValue;
};

const initialState: SaleActionState = {
  status: "idle"
};

function emptyItem() {
  return emptySaleLine(crypto.randomUUID());
}

export function SaleForm({ action, cancelHref, currency, customers, loyaltyLive, products, sale }: SaleFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();

  // A plan block opens the shared upgrade dialog instead of an inline error.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);
  const [items, setItems] = useState<SaleLine[]>(sale?.items?.length ? sale.items : [emptyItem()]);
  const [discount, setDiscount] = useState(sale?.discount ?? "0.00");
  const [tax, setTax] = useState(sale?.tax ?? "0.00");
  const [shipping, setShipping] = useState(sale?.shipping ?? "0.00");
  const [paidAmount, setPaidAmount] = useState(sale?.paidAmount ?? "0.00");
  const scanCatalogue = useMemo(
    () => buildSaleScanCatalogue(products, currency, stockHeldBySale(sale)),
    [currency, products, sale]
  );
  const productMap = scanCatalogue.products;
  const formRef = useRef<HTMLFormElement>(null);
  const totals = useMemo(() => calculateTotals(items, discount, tax, shipping, paidAmount), [discount, items, paidAmount, shipping, tax]);
  // The lines as of the last scan, so one scan straight after another always
  // counts the first — never a render behind it.
  const linesRef = useRef(items);
  // The lines as they were when a burst of keys aimed elsewhere began.
  const burstLines = useRef<SaleLine[] | null>(null);
  const [flash, setFlash] = useState<{ lineId: string } | null>(null);

  useLayoutEffect(() => {
    linesRef.current = items;
  }, [items]);

  // The line a scan just added to is tinted for a moment, so the cashier sees
  // which one moved without reading the table.
  useEffect(() => {
    if (!flash) {
      return;
    }

    const timer = window.setTimeout(() => setFlash(null), 900);

    return () => window.clearTimeout(timer);
  }, [flash]);

  function updateItem(id: string, patch: Partial<SaleLine>) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  /** See `ringUpScan`; this only decides which lines it starts from and shows the result. */
  function scanProduct(code: string, origin: SaleScanOrigin) {
    // A scan picked out of keys aimed at another field rings up on the lines
    // as they were before its first key, so nothing it did to a quantity or a
    // product list on the way through survives.
    const before = origin === "page" ? (burstLines.current ?? linesRef.current) : linesRef.current;
    const result = ringUpScan(before, scanCatalogue, code, () => crypto.randomUUID());

    burstLines.current = null;

    if (result.lines !== linesRef.current) {
      linesRef.current = result.lines;
      setItems(result.lines);
    }

    if (result.feedback.lineId) {
      setFlash({ lineId: result.feedback.lineId });
    }

    return result.feedback;
  }

  function selectProduct(id: string, productId: string) {
    const product = productMap.get(productId);
    updateItem(id, {
      productId,
      unitPrice: product?.price ?? "0.00",
      variantId: ""
    });
  }

  function selectVariant(id: string, product: SaleProductOption | undefined, variantId: string) {
    const variant = product?.variants?.find((entry) => entry.id === variantId);

    updateItem(id, {
      unitPrice: variant?.price ?? product?.price ?? "0.00",
      variantId
    });
  }

  return (
    <form action={formAction} className="resource-form compact-form catalog-create-form" onKeyDown={keepEnterFromSaving} ref={formRef}>
      {state.status === "error" && !state.lockedFeature ? <p className="form-error">{state.message}</p> : null}
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="customerId">
          <SaleCustomerPicker
            customers={customers}
            defaultCustomerId={sale?.customerId ?? null}
            defaultOptedIn={sale?.loyaltyOptedIn === true}
            programmeLive={loyaltyLive}
          />
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
        <SaleScanBox
          formRef={formRef}
          onBurstStart={() => {
            burstLines.current = linesRef.current;
          }}
          onScan={scanProduct}
        />
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
                const variants = product?.variants ?? [];
                const variant = variants.find((entry) => entry.id === item.variantId);

                return (
                  <tr className={`border-b border-[#efeff5] ${flash?.lineId === item.id ? "bg-[#f3efff]" : ""}`} key={item.id}>
                    <td className="p-3">
                      <div className="grid gap-2">
                        <select name="productId" onChange={(event) => selectProduct(item.id, event.target.value)} required value={item.productId}>
                          <option value="">Select product</option>
                          {products.map((entry) => (
                            <option key={entry.id} value={entry.id}>
                              {entry.title}
                            </option>
                          ))}
                        </select>
                        {/* One per row, blank when there is nothing to choose, so the posted lists line up. */}
                        {variants.length ? (
                          <select
                            aria-label={`Option of ${product?.title ?? "the product"}`}
                            name="variantId"
                            onChange={(event) => selectVariant(item.id, product, event.target.value)}
                            required
                            value={item.variantId}
                          >
                            <option value="">Choose option (size, colour…)</option>
                            {variants.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.title} — {entry.stockQuantity} in stock
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input name="variantId" type="hidden" value="" />
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[#686a76]">
                      {variant ? variant.stockQuantity : variants.length ? "—" : (product?.stockQuantity ?? "-")}
                    </td>
                    <td className="p-3"><input min={1} name="quantity" onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 1 })} type="number" value={item.quantity} /></td>
                    <td className="p-3"><input min={0} name="unitPrice" onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} step="0.01" type="number" value={item.unitPrice} /></td>
                    <td className="p-3"><input min={0} name="itemDiscount" onChange={(event) => updateItem(item.id, { discount: event.target.value })} step="0.01" type="number" value={item.discount} /></td>
                    <td className="p-3 font-semibold">{formatSaleMoney(lineTotal(item), currency)}</td>
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
            <SummaryRow label="Subtotal" value={formatSaleMoney(totals.subtotal, currency)} />
            <SummaryRow label="Total" strong value={formatSaleMoney(totals.total, currency)} />
            <SummaryRow label="Due" strong value={formatSaleMoney(totals.due, currency)} />
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

/**
 * Enter in a field never saves the sale — only the Save button does. At a till
 * an Enter arrives at the end of every scan, and one that reached a quantity
 * box would otherwise post a half-rung sale.
 */
function keepEnterFromSaving(event: KeyboardEvent<HTMLFormElement>) {
  const target = event.target;

  if (
    event.key === "Enter" &&
    target instanceof HTMLInputElement &&
    !["button", "image", "submit"].includes(target.type)
  ) {
    event.preventDefault();
  }
}

function lineTotal(item: SaleLine) {
  return Math.max((Number(item.unitPrice) || 0) * item.quantity - (Number(item.discount) || 0), 0);
}

function calculateTotals(items: SaleLine[], discount: string, tax: string, shipping: string, paid: string) {
  const subtotal = items.reduce((total, item) => total + lineTotal(item), 0);
  const total = Math.max(subtotal - (Number(discount) || 0) + (Number(tax) || 0) + (Number(shipping) || 0), 0);
  const paidAmount = Math.min(Number(paid) || 0, total);
  return { due: Math.max(total - paidAmount, 0), subtotal, total };
}
