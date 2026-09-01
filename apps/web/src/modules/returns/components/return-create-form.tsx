"use client";

import { Button } from "@dash/ui";
import { ImageIcon, Info } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import type { OrderReturnActionState } from "../return.actions";
import { orderRefundMethods, orderReturnReasons, orderReturnTypes } from "../return.schema";
import type { OrderReturnType } from "../return.schema";
import {
  orderRefundMethodLabels,
  orderReturnReasonLabels,
  orderReturnTypeLabels
} from "../return.types";

export type ReturnFormOrderLine = {
  id: string;
  imageUrl: string | null;
  productId: string | null;
  quantity: number;
  /** Units of this line no live request has already claimed. */
  remaining: number;
  sku: string | null;
  title: string;
  unitPrice: string;
};

export type ReturnFormProductOption = {
  id: string;
  price: string;
  sku: string | null;
  stockQuantity: number;
  title: string;
};

type ReturnCreateFormProps = {
  action: (state: OrderReturnActionState, formData: FormData) => Promise<OrderReturnActionState>;
  cancelHref: string;
  currency: string;
  defaultType: OrderReturnType;
  lines: ReturnFormOrderLine[];
  orderId: string;
  orderNumber: string;
  products: ReturnFormProductOption[];
  /** What the customer paid for delivery, offered as the obvious refund figure. */
  shippingAmount: string;
};

type LineState = {
  orderItemId: string;
  quantity: number;
  replacementProductId: string;
  replacementQuantity: number;
  selected: boolean;
};

const initialState: OrderReturnActionState = {
  status: "idle"
};

const inputClass =
  "h-11 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6]";
const labelClass = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-[#777985]";

export function ReturnCreateForm({
  action,
  cancelHref,
  currency,
  defaultType,
  lines,
  orderId,
  orderNumber,
  products,
  shippingAmount
}: ReturnCreateFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();

  // A plan refusal opens the shared upgrade dialog rather than reading as a
  // validation error the seller could fix by editing the fields.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);
  const [type, setType] = useState<OrderReturnType>(defaultType);
  const [rows, setRows] = useState<LineState[]>(() =>
    lines.map((line) => ({
      orderItemId: line.id,
      quantity: Math.max(1, line.remaining),
      // An exchange is usually the same product in another size or colour, so the
      // line starts pointed at itself and the seller retargets the ones that move.
      replacementProductId: line.productId ?? "",
      replacementQuantity: 0,
      selected: false
    }))
  );
  const [flatRefundAmount, setFlatRefundAmount] = useState("0.00");
  const [shippingRefundAmount, setShippingRefundAmount] = useState("0.00");
  const [restockingFee, setRestockingFee] = useState("0.00");

  const linesById = useMemo(() => new Map(lines.map((line) => [line.id, line])), [lines]);
  const productsById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );
  const isExchange = type === "EXCHANGE";
  const isRefund = type === "REFUND";
  const selected = rows.filter((row) => row.selected && row.quantity > 0);

  const goodsAmount = selected.length
    ? selected.reduce(
        (sum, row) => sum + Number(linesById.get(row.orderItemId)?.unitPrice ?? 0) * row.quantity,
        0
      )
    : Number(flatRefundAmount || 0);
  const replacementAmount = isExchange
    ? selected.reduce((sum, row) => {
        const product = productsById.get(row.replacementProductId);

        if (!product) return sum;

        return sum + Number(product.price) * (row.replacementQuantity || row.quantity);
      }, 0)
    : 0;
  const net =
    goodsAmount +
    Number(shippingRefundAmount || 0) -
    Number(restockingFee || 0) -
    replacementAmount;
  const refundAmount = Math.max(0, net);
  const dueAmount = isExchange ? Math.max(0, -net) : 0;

  // Mirrors what the service will rebuild from the order, so nothing here is
  // load-bearing — it exists so the seller sees the settlement before saving.
  const itemsPayload = JSON.stringify(
    selected.map((row) => ({
      orderItemId: row.orderItemId,
      quantity: row.quantity,
      ...(isExchange && row.replacementProductId
        ? {
            replacementProductId: row.replacementProductId,
            replacementQuantity: row.replacementQuantity || row.quantity
          }
        : {})
    }))
  );

  function updateRow(orderItemId: string, patch: Partial<LineState>) {
    setRows((current) =>
      current.map((row) => (row.orderItemId === orderItemId ? { ...row, ...patch } : row))
    );
  }

  return (
    <form action={formAction} className="grid gap-6">
      <input name="orderId" type="hidden" value={orderId} />
      <input name="items" type="hidden" value={itemsPayload} />
      <input name="type" type="hidden" value={type} />

      {state.status === "error" && state.message && !state.lockedFeature ? (
        <p className="error-message">{state.message}</p>
      ) : null}

      <section className="grid gap-3">
        <span className={labelClass}>What is happening</span>
        <div className="grid gap-3 sm:grid-cols-3">
          {orderReturnTypes.map((option) => (
            <button
              className={`rounded-xl border px-4 py-3 text-left transition ${type === option ? "border-[#7c3aed] bg-[#f7f3ff]" : "border-[#e5e3f1] bg-white hover:border-[#cfc7f5]"}`}
              key={option}
              onClick={() => setType(option)}
              type="button"
            >
              <strong className="block text-sm text-[#292a34]">
                {orderReturnTypeLabels[option]}
              </strong>
              <span className="mt-1 block text-[11px] leading-4 text-[#777985]">
                {typeHint(option)}
              </span>
            </button>
          ))}
        </div>
        {state.fieldErrors?.type ? (
          <p className="m-0 text-[11px] text-rose-600">{state.fieldErrors.type}</p>
        ) : null}
      </section>

      <section className="grid gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={`${labelClass} mb-0`}>Items from {orderNumber}</span>
          {isRefund ? (
            <span className="inline-flex items-center gap-1.5 text-[11px] text-[#777985]">
              <Info className="h-3.5 w-3.5" />
              Optional on a refund — leave every line unticked to refund a flat amount.
            </span>
          ) : null}
        </div>
        <div className="overflow-hidden rounded-xl border border-[#ececf5]">
          <div className="max-w-full overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-xs">
              <thead className="bg-[#f7f7fa] text-[#5f616d]">
                <tr>
                  <th className="p-3">Item</th>
                  <th className="p-3">Unit price</th>
                  <th className="p-3">Still open</th>
                  <th className="p-3">Coming back</th>
                  {isExchange ? <th className="p-3">Replacement</th> : null}
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const row = rows.find((entry) => entry.orderItemId === line.id);
                  const disabled = line.remaining <= 0;

                  return (
                    <tr className="border-b border-[#efeff5] last:border-b-0" key={line.id}>
                      <td className="p-3">
                        <label className="flex items-center gap-3">
                          <input
                            checked={Boolean(row?.selected)}
                            disabled={disabled}
                            onChange={(event) =>
                              updateRow(line.id, { selected: event.target.checked })
                            }
                            type="checkbox"
                          />
                          <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#ecebf2] bg-[#fafafa]">
                            {line.imageUrl ? (
                              <img
                                alt={line.title}
                                className="h-full w-full object-cover"
                                src={line.imageUrl}
                              />
                            ) : (
                              <ImageIcon className="h-4 w-4 text-[#b6b7c0]" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <strong className="block truncate font-semibold text-[#292a34]">
                              {line.title}
                            </strong>
                            <span className="text-[#777985]">{line.sku ?? "No SKU"}</span>
                          </span>
                        </label>
                      </td>
                      <td className="p-3">{formatMoney(line.unitPrice, currency)}</td>
                      <td className="p-3 text-[#777985]">
                        {line.remaining} of {line.quantity}
                      </td>
                      <td className="p-3">
                        <input
                          aria-label={`Quantity returning for ${line.title}`}
                          className="h-10 w-20 rounded-lg border border-[#e5e3f1] px-2.5 text-sm outline-none focus:border-[#8b5cf6]"
                          disabled={disabled || !row?.selected}
                          max={Math.max(1, line.remaining)}
                          min={1}
                          onChange={(event) =>
                            updateRow(line.id, {
                              quantity: clamp(Number(event.target.value), 1, line.remaining)
                            })
                          }
                          type="number"
                          value={row?.quantity ?? 1}
                        />
                      </td>
                      {isExchange ? (
                        <td className="p-3">
                          <select
                            aria-label={`Replacement for ${line.title}`}
                            className="h-10 w-56 rounded-lg border border-[#e5e3f1] bg-white px-2.5 text-sm outline-none focus:border-[#8b5cf6]"
                            disabled={disabled || !row?.selected}
                            onChange={(event) =>
                              updateRow(line.id, { replacementProductId: event.target.value })
                            }
                            value={row?.replacementProductId ?? ""}
                          >
                            <option value="">No replacement</option>
                            {products.map((product) => (
                              <option key={product.id} value={product.id}>
                                {product.title} · {formatMoney(product.price, currency)} ·{" "}
                                {product.stockQuantity} in stock
                              </option>
                            ))}
                          </select>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        {state.fieldErrors?.items ? (
          <p className="m-0 text-[11px] text-rose-600">{state.fieldErrors.items}</p>
        ) : null}
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="reason">
            Reason
          </label>
          <select className={inputClass} defaultValue="OTHER" id="reason" name="reason">
            {orderReturnReasons.map((reason) => (
              <option key={reason} value={reason}>
                {orderReturnReasonLabels[reason]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass} htmlFor="refundMethod">
            Refund goes back by
          </label>
          <select
            className={inputClass}
            defaultValue="ORIGINAL_PAYMENT"
            id="refundMethod"
            name="refundMethod"
          >
            {orderRefundMethods.map((method) => (
              <option key={method} value={method}>
                {orderRefundMethodLabels[method]}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className={labelClass} htmlFor="reasonNote">
            Note
          </label>
          <textarea
            className="min-h-24 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 py-2.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6]"
            id="reasonNote"
            name="reasonNote"
            placeholder="What the customer said, and anything the person receiving the parcel should know."
          />
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {selected.length === 0 ? (
          <div>
            <label className={labelClass} htmlFor="flatRefundAmount">
              Refund amount
            </label>
            <input
              className={inputClass}
              id="flatRefundAmount"
              inputMode="decimal"
              name="flatRefundAmount"
              onChange={(event) => setFlatRefundAmount(event.target.value)}
              value={flatRefundAmount}
            />
            {state.fieldErrors?.flatRefundAmount ? (
              <p className="m-0 mt-1 text-[11px] text-rose-600">
                {state.fieldErrors.flatRefundAmount}
              </p>
            ) : null}
          </div>
        ) : null}
        <div>
          <label className={labelClass} htmlFor="shippingRefundAmount">
            Delivery refund
          </label>
          <input
            className={inputClass}
            id="shippingRefundAmount"
            inputMode="decimal"
            name="shippingRefundAmount"
            onChange={(event) => setShippingRefundAmount(event.target.value)}
            value={shippingRefundAmount}
          />
          <button
            className="mt-1.5 text-[11px] font-semibold text-[#6d3cf5] hover:underline"
            onClick={() => setShippingRefundAmount(Number(shippingAmount).toFixed(2))}
            type="button"
          >
            Refund the full {formatMoney(shippingAmount, currency)} delivery charge
          </button>
        </div>
        <div>
          <label className={labelClass} htmlFor="restockingFee">
            Restocking fee
          </label>
          <input
            className={inputClass}
            id="restockingFee"
            inputMode="decimal"
            name="restockingFee"
            onChange={(event) => setRestockingFee(event.target.value)}
            value={restockingFee}
          />
        </div>
      </section>

      {isRefund ? null : (
        <label className="flex items-start gap-3 rounded-xl border border-[#ececf5] bg-white p-4">
          <input defaultChecked name="restockItems" type="checkbox" />
          <span>
            <strong className="block text-sm text-[#292a34]">Put the goods back in stock</strong>
            <span className="mt-1 block text-[11px] leading-4 text-[#777985]">
              Stock moves when you mark the parcel received, not now. Leave this off for anything
              damaged or defective.
            </span>
          </span>
        </label>
      )}

      <section className="rounded-xl border border-[#ececf5] bg-[#fbfaff] p-5">
        <dl className="grid grid-cols-[1fr_auto] gap-x-5 gap-y-3 text-xs">
          <dt className="text-[#777985]">Goods coming back</dt>
          <dd className="m-0 font-medium">{formatMoney(goodsAmount, currency)}</dd>
          <dt className="text-[#777985]">Delivery refund</dt>
          <dd className="m-0 font-medium">{formatMoney(shippingRefundAmount || 0, currency)}</dd>
          <dt className="text-[#777985]">Restocking fee</dt>
          <dd className="m-0 font-medium text-rose-600">
            -{formatMoney(restockingFee || 0, currency)}
          </dd>
          {isExchange ? (
            <>
              <dt className="text-[#777985]">Replacement going out</dt>
              <dd className="m-0 font-medium text-rose-600">
                -{formatMoney(replacementAmount, currency)}
              </dd>
            </>
          ) : null}
          <dt className="mt-2 border-t border-[#e7e4f5] pt-4 text-sm font-semibold">
            Refund to customer
          </dt>
          <dd className="m-0 mt-2 border-t border-[#e7e4f5] pt-4 text-xl font-bold text-[#6d3cf5]">
            {formatMoney(refundAmount, currency)}
          </dd>
          {dueAmount > 0 ? (
            <>
              <dt className="text-sm font-semibold">Customer still owes</dt>
              <dd className="m-0 text-sm font-bold text-[#e49a00]">
                {formatMoney(dueAmount, currency)}
              </dd>
            </>
          ) : null}
        </dl>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button className="catalog-submit-button" disabled={isPending} type="submit">
          {isPending ? "Opening…" : `Open ${orderReturnTypeLabels[type].toLowerCase()}`}
        </Button>
        <Link className="secondary link-button" href={cancelHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function typeHint(type: OrderReturnType) {
  if (type === "EXCHANGE") return "Goods come back, replacement goods go out.";
  if (type === "REFUND") return "Money goes back, nothing comes back.";

  return "Goods come back, money goes back.";
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;

  return Math.min(Math.max(Math.trunc(value), min), Math.max(min, max));
}

function formatMoney(value: string | number, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value) || 0);
}
