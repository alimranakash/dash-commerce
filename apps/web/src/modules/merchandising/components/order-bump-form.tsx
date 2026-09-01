"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import { saveOrderBumpFormAction, type OrderBumpActionState } from "../order-bump.actions";
import { orderBumpOfferPrice, type OrderBumpDiscountType } from "../order-bump.schema";
import type { OrderBumpProductOption, OrderBumpSettings } from "../order-bump.service";

type OrderBumpFormProps = {
  currency: string;
  products: OrderBumpProductOption[];
  settings: OrderBumpSettings;
};

const initialState: OrderBumpActionState = {
  status: "idle"
};

export function OrderBumpForm({ currency, products, settings }: OrderBumpFormProps) {
  const [state, formAction, isPending] = useActionState(saveOrderBumpFormAction, initialState);
  const { openUpgrade } = useUpgradePrompt();

  // A plan refusal opens the shared upgrade dialog rather than reading as a
  // validation error the seller could fix by editing the fields.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);
  const [enabled, setEnabled] = useState(settings.enabled);
  const [productId, setProductId] = useState(settings.productId ?? "");
  const [discountType, setDiscountType] = useState<OrderBumpDiscountType>(settings.discountType);
  const [discountValue, setDiscountValue] = useState(settings.discountValue);
  // The same function the checkout prices with, so what the seller is shown
  // here is what a shopper would be charged.
  const preview = useMemo(() => {
    const product = products.find((entry) => entry.id === productId);

    if (!product) {
      return null;
    }

    const pricing = orderBumpOfferPrice({
      discountType,
      discountValue,
      listPrice: product.price
    });

    return pricing ? { ...pricing, listPrice: product.price, title: product.title } : null;
  }, [discountType, discountValue, productId, products]);

  return (
    <form action={formAction} className="grid max-w-3xl gap-5">
      {state.status === "error" && !state.lockedFeature ? (
        <p className="m-0 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message}</p>
      ) : null}
      {state.status === "saved" ? (
        <p className="m-0 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Offer saved.
        </p>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <label className="flex items-start gap-3">
          <input
            checked={enabled}
            className="mt-1 h-4 w-4"
            name="enabled"
            onChange={(event) => setEnabled(event.target.checked)}
            type="checkbox"
          />
          <span className="grid gap-1">
            <strong className="text-sm font-semibold text-[#252238]">Show the offer</strong>
            <small className="text-xs leading-relaxed text-[#77748a]">
              A single tick box directly above the Place Order button. It is skipped whenever there
              is nothing sensible to offer, so turning it on does not force one onto every checkout.
            </small>
          </span>
        </label>
      </section>

      <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <header className="grid gap-1">
          <h2 className="m-0 text-base font-semibold text-[#252238]">What to offer</h2>
          <p className="m-0 text-xs leading-relaxed text-[#77748a]">
            Leave this on automatic and each checkout offers whatever the cart&apos;s own pairings
            and your co-purchase history put first. Pin a product to offer the same one to everyone.
          </p>
        </header>
        <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
          Product
          <select
            className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
            name="productId"
            onChange={(event) => setProductId(event.target.value)}
            value={productId}
          >
            <option value="">Automatic — pick from this cart</option>
            {products.map((product) => (
              <option key={product.id} value={product.id}>
                {product.title}
              </option>
            ))}
          </select>
          <small className="text-xs text-[#77748a]">
            Only active, public products without options can be pinned — the offer is one tick, with
            nowhere to ask which size.
          </small>
        </label>
      </section>

      <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <header className="grid gap-1">
          <h2 className="m-0 text-base font-semibold text-[#252238]">The discount</h2>
          <p className="m-0 text-xs leading-relaxed text-[#77748a]">
            Taken off whatever the offered product costs at the moment of checkout, so a price
            change never leaves a stale offer standing.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
            Type
            <select
              className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              name="discountType"
              onChange={(event) => setDiscountType(event.target.value as OrderBumpDiscountType)}
              value={discountType}
            >
              <option value="PERCENTAGE">Percentage off</option>
              <option value="FIXED">Fixed amount off</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
            {discountType === "PERCENTAGE" ? "Percent off" : `Amount off (${currency})`}
            <input
              className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              min={0}
              name="discountValue"
              onChange={(event) => setDiscountValue(event.target.value)}
              step="0.01"
              type="number"
              value={discountValue}
            />
          </label>
        </div>
        {preview ? (
          <p className="m-0 rounded-lg bg-[#f6f3ff] px-4 py-3 text-sm text-[#3d2279]">
            {preview.title} would be offered at{" "}
            <strong>{formatMoney(preview.offerPrice, currency)}</strong> instead of{" "}
            {formatMoney(preview.listPrice, currency)} — a saving of{" "}
            {formatMoney(preview.savingAmount, currency)}.
          </p>
        ) : null}
        {productId && !preview ? (
          <p className="m-0 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            That discount leaves the price unchanged, so nothing would be offered. Raise it.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <header className="grid gap-1">
          <h2 className="m-0 text-base font-semibold text-[#252238]">What it says</h2>
          <p className="m-0 text-xs leading-relaxed text-[#77748a]">
            Leave the description empty and the product&apos;s own short description is used.
          </p>
        </header>
        <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
          Headline
          <input
            className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
            defaultValue={settings.headline}
            maxLength={120}
            name="headline"
            placeholder="Add this to your order"
            type="text"
          />
          {state.fieldErrors?.headline ? (
            <small className="text-xs text-rose-600">{state.fieldErrors.headline}</small>
          ) : null}
        </label>
        <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
          Description
          <textarea
            className="rounded-lg border border-[#e4e3ee] px-3 py-2 text-sm"
            defaultValue={settings.description}
            maxLength={240}
            name="description"
            placeholder="One line on why it belongs with what they are already buying."
            rows={3}
          />
        </label>
      </section>

      <div>
        <button
          className="inline-flex h-11 items-center rounded-lg bg-[#6d3cf5] px-5 text-sm font-semibold text-white transition hover:bg-[#5b2fe0] disabled:opacity-70"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Saving..." : "Save offer"}
        </button>
      </div>
    </form>
  );
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value) || 0);
}
