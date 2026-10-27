"use client";

import { Button } from "@dash/ui";
import { Minus, Plus, Printer, Trash2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import type { SaleActionState } from "../sale.actions";
import type { SaleCustomerOption } from "../sale-customer";
import { SALE_DISCOUNT_MAX_PERCENT, saleDiscountCents, type SaleDiscountType } from "../sale-discount";
import {
  buildSaleScanCatalogue,
  emptySaleLine,
  formatSaleMoney,
  lineStock,
  ringUpScan,
  stockHeldBySale,
  type SaleLine,
  type SaleLineStock,
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

/**
 * Save says what it will do, because the status decides whether stock moves —
 * a cashier who leaves the default and presses "Save Sale" would otherwise
 * record a draft and wonder why nothing left the shelf.
 */
const SAVE_LABELS: Record<SaleStatus, string> = {
  CANCELLED: "Save as cancelled",
  COMPLETED: "Complete sale",
  DRAFT: "Save as draft",
  RETURNED: "Save as returned"
};

const STATUS_NOTES: Partial<Record<SaleStatus, string>> = {
  COMPLETED: "Completing takes the items out of stock.",
  DRAFT: "A draft takes nothing out of stock until it is completed."
};

function emptyItem() {
  return emptySaleLine(crypto.randomUUID());
}

/**
 * The sale counter, for a new sale and an edited one. The cart and its scan
 * box lead; customer, payment and the total sit beside it, the total's card
 * following the cashier down a long cart (see `.sale-pos-layout`). Every field
 * posts under the same name it always has, so the action is untouched.
 */
export function SaleForm({ action, cancelHref, currency, customers, loyaltyLive, products, sale }: SaleFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();

  // A plan block opens the shared upgrade dialog instead of an inline error.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);
  const [items, setItems] = useState<SaleLine[]>(sale?.items?.length ? sale.items : [emptyItem()]);
  const [discount, setDiscount] = useState(sale?.discount ?? "0.00");
  // A saved sale stores only the amount its discount came to, so it reopens as one.
  const [discountType, setDiscountType] = useState<SaleDiscountType>("AMOUNT");
  const [tax, setTax] = useState(sale?.tax ?? "0.00");
  const [shipping, setShipping] = useState(sale?.shipping ?? "0.00");
  const [paidAmount, setPaidAmount] = useState(sale?.paidAmount ?? "0.00");
  const [status, setStatus] = useState<SaleStatus>(sale?.status ?? "DRAFT");
  const paidId = useId();
  const discountId = useId();
  const discountRef = useRef<HTMLInputElement>(null);
  const currencySymbol = useMemo(() => currencySymbolFor(currency), [currency]);
  const scanCatalogue = useMemo(
    () => buildSaleScanCatalogue(products, currency, stockHeldBySale(sale)),
    [currency, products, sale]
  );
  const productMap = scanCatalogue.products;
  const formRef = useRef<HTMLFormElement>(null);
  const totals = useMemo(
    () => calculateTotals(items, discount, discountType, tax, shipping, paidAmount),
    [discount, discountType, items, paidAmount, shipping, tax]
  );
  const discountOverLimit = discountType === "PERCENT" && Number(discount) > SALE_DISCOUNT_MAX_PERCENT;
  const itemCount = items.reduce((count, item) => count + (item.productId ? item.quantity : 0), 0);
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

  /** A new kind of discount starts empty: 50 taka read as 50% is not a conversion anyone asked for. */
  function changeDiscountType(type: SaleDiscountType) {
    if (type === discountType) {
      return;
    }

    setDiscountType(type);
    setDiscount("");
    discountRef.current?.focus();
  }

  function selectVariant(id: string, product: SaleProductOption | undefined, variantId: string) {
    const variant = product?.variants?.find((entry) => entry.id === variantId);

    updateItem(id, {
      unitPrice: variant?.price ?? product?.price ?? "0.00",
      variantId
    });
  }

  return (
    <form action={formAction} className="product-editor-form sale-pos" onKeyDown={keepEnterFromSaving} ref={formRef}>
      <div className="sale-pos-layout">
        <section className="product-editor-card sale-pos-cart">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2>Cart</h2>
              <p>
                {itemCount
                  ? `${itemCount} ${itemCount === 1 ? "item" : "items"} · ${formatSaleMoney(totals.subtotal, currency)}`
                  : "Scan a barcode, or pick a product below."}
              </p>
            </div>
            <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#ddd6fe] px-3 text-xs font-semibold text-[#6d3cf5]" onClick={() => setItems((current) => [...current, emptyItem()])} type="button">
              <Plus className="h-3.5 w-3.5" /> Add product
            </button>
          </header>
          <SaleScanBox
            formRef={formRef}
            onBurstStart={() => {
              burstLines.current = linesRef.current;
            }}
            onScan={scanProduct}
          />
          <div className="overflow-x-auto px-5 pb-5 pt-4">
            <table className="sale-lines w-full min-w-[640px] border-collapse text-left text-xs">
              <thead className="bg-[#f7f7fa] text-[#565762]">
                <tr>
                  <th className="rounded-l-lg p-3">Product</th>
                  <th className="w-[124px] p-3">Qty</th>
                  <th className="w-[108px] p-3">Unit price</th>
                  <th className="w-[96px] p-3">Discount</th>
                  <th className="w-[108px] p-3 text-right">Line total</th>
                  <th className="w-12 rounded-r-lg p-3">
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const product = productMap.get(item.productId);
                  const variants = product?.variants ?? [];

                  return (
                    <tr className={`border-b border-[#efeff5] ${flash?.lineId === item.id ? "bg-[#f3efff]" : ""}`} key={item.id}>
                      <td className="p-3 align-top">
                        <div className="grid gap-2">
                          <select aria-label="Product" name="productId" onChange={(event) => selectProduct(item.id, event.target.value)} required value={item.productId}>
                            <option value="">Select product</option>
                            {products.map((entry) => (
                              <option key={entry.id} value={entry.id}>
                                {entry.title}
                                {entry.archived ? " (in trash)" : ""}
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
                          {product ? (
                            <StockHint
                              stock={lineStock(items, scanCatalogue, item.productId, item.variantId)}
                              waitingForOption={variants.length > 0 && !item.variantId}
                            />
                          ) : null}
                        </div>
                      </td>
                      <td className="p-3 align-top">
                        <div className="sale-qty">
                          <button aria-label="One fewer" disabled={item.quantity <= 1} onClick={() => updateItem(item.id, { quantity: Math.max(item.quantity - 1, 1) })} type="button">
                            <Minus className="h-3.5 w-3.5" />
                          </button>
                          <input aria-label="Quantity" min={1} name="quantity" onChange={(event) => updateItem(item.id, { quantity: Number(event.target.value) || 1 })} type="number" value={item.quantity} />
                          <button aria-label="One more" onClick={() => updateItem(item.id, { quantity: item.quantity + 1 })} type="button">
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 align-top"><input aria-label="Unit price" min={0} name="unitPrice" onChange={(event) => updateItem(item.id, { unitPrice: event.target.value })} step="0.01" type="number" value={item.unitPrice} /></td>
                      <td className="p-3 align-top"><input aria-label="Line discount" min={0} name="itemDiscount" onChange={(event) => updateItem(item.id, { discount: event.target.value })} step="0.01" type="number" value={item.discount} /></td>
                      <td className="p-3 text-right align-top font-semibold leading-[38px] tabular-nums">{formatSaleMoney(lineTotal(item), currency)}</td>
                      <td className="p-3 text-right align-top"><button aria-label="Remove line" className="inline-grid h-[38px] w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-40" disabled={items.length === 1} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))} type="button"><Trash2 className="h-4 w-4" /></button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="product-editor-card sale-pos-details">
          <header>
            <h2>Sale details</h2>
            <p>Where and when it was sold, and notes only your team sees.</p>
          </header>
          <div className="product-editor-card-body">
            <div className="form-grid">
              <FieldError errors={state.fieldErrors} name="saleType">
                <label>
                  Sale type
                  <select defaultValue={sale?.saleType ?? "OFFLINE"} name="saleType">
                    <option value="OFFLINE">Offline</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </label>
              </FieldError>
              <FieldError errors={state.fieldErrors} name="saleDate">
                <label>
                  Sale date
                  <input defaultValue={sale?.saleDate ?? today()} name="saleDate" required type="date" />
                </label>
              </FieldError>
            </div>
            <FieldError errors={state.fieldErrors} name="notes">
              <label>
                Notes
                <textarea defaultValue={sale?.notes ?? ""} name="notes" placeholder="Internal notes" rows={3} />
              </label>
            </FieldError>
          </div>
        </section>

        <aside className="sale-pos-side">
          <section className="product-editor-card">
            <div className="product-editor-card-body">
              <FieldError errors={state.fieldErrors} name="customerId">
                <SaleCustomerPicker
                  customers={customers}
                  defaultCustomerId={sale?.customerId ?? null}
                  defaultOptedIn={sale?.loyaltyOptedIn === true}
                  programmeLive={loyaltyLive}
                />
              </FieldError>
            </div>
          </section>

          <section className="product-editor-card">
            <header>
              <h2>Payment</h2>
            </header>
            <div className="product-editor-card-body">
              <FieldError errors={state.fieldErrors} name="paymentMethod">
                <label>
                  Payment method
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
              <FieldError errors={state.fieldErrors} name="discount">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={discountId}>Discount</label>
                  <div aria-label="Discount type" className="inline-flex rounded-lg border border-[#e4e3ee] p-0.5" role="group">
                    {(["AMOUNT", "PERCENT"] as const).map((type) => (
                      <button
                        aria-label={type === "PERCENT" ? "Percentage" : "Amount"}
                        aria-pressed={discountType === type}
                        className={`h-7 min-w-9 rounded-md px-2 text-xs font-semibold ${discountType === type ? "bg-[#6d3cf5] text-white" : "text-[#686a76] hover:text-[#6d3cf5]"}`}
                        key={type}
                        onClick={() => changeDiscountType(type)}
                        type="button"
                      >
                        {type === "PERCENT" ? "%" : currencySymbol}
                      </button>
                    ))}
                  </div>
                </div>
                <input name="discountType" type="hidden" value={discountType} />
                <span className="product-editor-input-affix" {...(discountType === "AMOUNT" ? { "data-affix": "start" } : {})}>
                  {discountType === "AMOUNT" ? <span aria-hidden="true">{currencySymbol}</span> : null}
                  <input
                    id={discountId}
                    max={discountType === "PERCENT" ? SALE_DISCOUNT_MAX_PERCENT : undefined}
                    min={0}
                    name="discount"
                    onChange={(event) => setDiscount(event.target.value)}
                    placeholder="0"
                    ref={discountRef}
                    step="0.01"
                    type="number"
                    value={discount}
                  />
                  {discountType === "PERCENT" ? <span aria-hidden="true">%</span> : null}
                </span>
                {discountOverLimit ? (
                  <span className="text-[11px] font-medium text-rose-600">A discount can be at most {SALE_DISCOUNT_MAX_PERCENT}%.</span>
                ) : discountType === "PERCENT" && totals.discount > 0 ? (
                  <span className="text-[11px] text-[#686a76]">
                    {formatSaleMoney(totals.discount, currency)} off {formatSaleMoney(totals.subtotal, currency)}
                  </span>
                ) : null}
              </FieldError>
              <div className="grid grid-cols-2 gap-3">
                <AmountInput errors={state.fieldErrors} label="Tax" name="tax" onChange={setTax} symbol={currencySymbol} value={tax} />
                <AmountInput errors={state.fieldErrors} label="Shipping" name="shipping" onChange={setShipping} symbol={currencySymbol} value={shipping} />
              </div>
            </div>
          </section>

          <section className="product-editor-card sale-pos-checkout">
            <div className="product-editor-card-body">
              <div className="grid gap-2">
                <SummaryRow label="Subtotal" value={formatSaleMoney(totals.subtotal, currency)} />
                {totals.discount > 0 ? (
                  <SummaryRow
                    label={discountType === "PERCENT" ? `Discount (${Number(discount)}%)` : "Discount"}
                    value={`− ${formatSaleMoney(totals.discount, currency)}`}
                  />
                ) : null}
                {Number(tax) > 0 ? <SummaryRow label="Tax" value={`+ ${formatSaleMoney(Number(tax), currency)}`} /> : null}
                {Number(shipping) > 0 ? <SummaryRow label="Shipping" value={`+ ${formatSaleMoney(Number(shipping), currency)}`} /> : null}
                <div className="flex items-baseline justify-between gap-3 border-t border-[#ececf5] pt-3 text-[#20212a]">
                  <span className="text-sm font-semibold">Total</span>
                  <span className="text-2xl font-bold tabular-nums">{formatSaleMoney(totals.total, currency)}</span>
                </div>
              </div>
              <div className="field-shell">
                <div className="flex items-center justify-between gap-2">
                  <label htmlFor={paidId}>Paid amount</label>
                  <button className="text-xs font-semibold text-[#6d3cf5]" onClick={() => setPaidAmount(totals.total.toFixed(2))} type="button">
                    Paid in full
                  </button>
                </div>
                <input id={paidId} min={0} name="paidAmount" onChange={(event) => setPaidAmount(event.target.value)} step="0.01" type="number" value={paidAmount} />
              </div>
              {/* Cash handed over beyond the total is change, not credit: the server records the total as paid. */}
              {totals.change > 0 ? (
                <SummaryRow label="Change to give" strong tone="change" value={formatSaleMoney(totals.change, currency)} />
              ) : (
                <SummaryRow label="Due" strong value={formatSaleMoney(totals.due, currency)} />
              )}
              <FieldError errors={state.fieldErrors} name="status">
                <label>
                  Status
                  <select name="status" onChange={(event) => setStatus(event.target.value as SaleStatus)} value={status}>
                    <option value="DRAFT">Draft</option>
                    <option value="COMPLETED">Completed</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="RETURNED">Returned</option>
                  </select>
                </label>
              </FieldError>
              {STATUS_NOTES[status] ? <p className="m-0 -mt-2 text-[11px] leading-5 text-[#686a76]">{STATUS_NOTES[status]}</p> : null}
              {state.status === "error" && !state.lockedFeature ? <p className="form-error">{state.message}</p> : null}
              <Button className="primary action-button w-full" disabled={isPending} type="submit">
                {isPending ? "Saving..." : SAVE_LABELS[status]}
              </Button>
              {/* The same save, then straight to the receipt with the print dialog open. */}
              {status === "COMPLETED" ? (
                <Button className="secondary action-button inline-flex w-full items-center justify-center gap-2" disabled={isPending} name="intent" type="submit" value="print">
                  <Printer aria-hidden="true" className="h-4 w-4" />
                  {sale ? "Save & print receipt" : "Complete & print receipt"}
                </Button>
              ) : null}
              <Link className="justify-self-center text-xs font-semibold" href={cancelHref}>
                Cancel
              </Link>
            </div>
          </section>
        </aside>
      </div>
    </form>
  );
}

/** Under a line's product: what this sale may take, and a warning once it asks for more. */
function StockHint({ stock, waitingForOption }: { stock: SaleLineStock | null; waitingForOption: boolean }) {
  if (waitingForOption) {
    return <span className="text-[11px] font-medium text-amber-700">Choose which option was sold.</span>;
  }

  if (!stock) {
    return null;
  }

  if (!stock.tracked) {
    return <span className="text-[11px] text-[#686a76]">{stock.available} available · keeps selling</span>;
  }

  if (stock.onSale > stock.available) {
    return (
      <span className="text-[11px] font-medium text-rose-600">
        {stock.available > 0 ? `Only ${stock.available} available` : "Out of stock"} — completing needs the stock.
      </span>
    );
  }

  return <span className="text-[11px] text-[#686a76]">{stock.available} available</span>;
}

/** The sign sits inside the border, and the input can shrink to its column — a bare one would not. */
function AmountInput({
  errors,
  label,
  name,
  onChange,
  symbol,
  value
}: {
  errors?: Record<string, string> | undefined;
  label: string;
  name: string;
  onChange: (value: string) => void;
  symbol: string;
  value: string;
}) {
  return (
    <FieldError errors={errors} name={name}>
      <label>
        {label}
        <span className="product-editor-input-affix" data-affix="start">
          <span aria-hidden="true">{symbol}</span>
          <input min={0} name={name} onChange={(event) => onChange(event.target.value)} placeholder="0" step="0.01" type="number" value={value} />
        </span>
      </label>
    </FieldError>
  );
}

function SummaryRow({ label, strong, tone, value }: { label: string; strong?: boolean; tone?: "change"; value: string }) {
  const colour = tone === "change" ? "text-emerald-700" : strong ? "text-[#20212a]" : "text-[#686a76]";

  return <div className={`flex items-center justify-between gap-3 ${strong ? "text-base font-bold" : "text-sm"} ${colour}`}><span>{label}</span><span className="tabular-nums">{value}</span></div>;
}

function FieldError({ children, errors, name }: { children: ReactNode; errors?: Record<string, string> | undefined; name: string }) {
  return <div className="field-shell">{children}{errors?.[name] ? <span className="field-error">{errors[name]}</span> : null}</div>;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

/** "৳" for BDT; the code itself for anything the browser has no symbol for. */
function currencySymbolFor(currency: string) {
  try {
    return (
      new Intl.NumberFormat("en", { currency, currencyDisplay: "narrowSymbol", style: "currency" })
        .formatToParts(0)
        .find((part) => part.type === "currency")?.value ?? currency
    );
  } catch {
    return currency;
  }
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

function calculateTotals(items: SaleLine[], discount: string, discountType: SaleDiscountType, tax: string, shipping: string, paid: string) {
  const subtotal = items.reduce((total, item) => total + lineTotal(item), 0);
  // The rule the server saves with, so the total on screen is the total recorded.
  const discountAmount = saleDiscountCents(Math.round(subtotal * 100), discount, discountType) / 100;
  const total = Math.max(subtotal - discountAmount + (Number(tax) || 0) + (Number(shipping) || 0), 0);
  const paidAmount = Math.min(Number(paid) || 0, total);
  return {
    change: Math.max((Number(paid) || 0) - total, 0),
    discount: discountAmount,
    due: Math.max(total - paidAmount, 0),
    subtotal,
    total
  };
}
