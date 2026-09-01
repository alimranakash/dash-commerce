"use client";

import { Plus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import type { BundleActionState } from "../bundle.actions";
import { priceBundles } from "../bundle-pricing";
import { MAX_BUNDLE_ITEMS, describeBundle, type BundleDiscountType, type BundleStatus, type BundleType } from "../bundle.schema";
import type { BundleProductOption, BundleSummary } from "../bundle.service";

type BundleFormProps = {
  action: (state: BundleActionState, formData: FormData) => Promise<BundleActionState>;
  bundle?: BundleSummary;
  cancelHref: string;
  currency: string;
  heading: string;
  products: BundleProductOption[];
  submitLabel: string;
};

type BundleFormItem = {
  productId: string;
  quantity: number;
};

const initialState: BundleActionState = {
  status: "idle"
};

export function BundleForm({
  action,
  bundle,
  cancelHref,
  currency,
  heading,
  products,
  submitLabel
}: BundleFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();

  // A plan refusal opens the shared upgrade dialog rather than reading as a
  // validation error the seller could fix by editing the fields.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);
  const [type, setType] = useState<BundleType>(bundle?.type ?? "SET");
  const [discountType, setDiscountType] = useState<BundleDiscountType>(bundle?.discountType ?? "PERCENTAGE");
  const [discountValue, setDiscountValue] = useState(bundle?.discountValue ?? "10");
  const [buyQuantity, setBuyQuantity] = useState(String(bundle?.buyQuantity || 2));
  const [getQuantity, setGetQuantity] = useState(String(bundle?.getQuantity || 1));
  const [items, setItems] = useState<BundleFormItem[]>(
    bundle?.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) ?? []
  );
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const unpicked = products.filter((product) => !items.some((item) => item.productId === product.id));
  const summary = describeBundle({
    buyQuantity: Number(buyQuantity) || 0,
    discountType,
    discountValue,
    getQuantity: Number(getQuantity) || 0,
    itemCount: items.length,
    type
  });
  // The seller sees the deal run against a cart that exactly qualifies, priced
  // by the same function the storefront and the order use.
  const preview = useMemo(() => {
    if (items.length === 0) {
      return null;
    }

    const lines = items.flatMap((item) => {
      const product = productsById.get(item.productId);

      if (!product) {
        return [];
      }

      return [
        {
          lineId: item.productId,
          price: product.price,
          productId: item.productId,
          // Enough units for the rule to fire once, whichever shape it is.
          quantity: type === "QUANTITY" ? (Number(buyQuantity) || 0) + (Number(getQuantity) || 0) : item.quantity
        }
      ];
    });
    const cartValue = lines.reduce((total, item) => total + Number(item.price) * item.quantity, 0);
    const result = priceBundles(lines, [
      {
        buyQuantity: Number(buyQuantity) || 0,
        description: summary,
        discountType,
        discountValue,
        getQuantity: Number(getQuantity) || 0,
        id: "preview",
        items: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
        name: "Preview",
        type
      }
    ]);

    return { cartValue, saving: Number(result.discountAmount) };
  }, [buyQuantity, discountType, discountValue, getQuantity, items, productsById, summary, type]);

  function addItem(productId: string) {
    if (!productId || items.length >= MAX_BUNDLE_ITEMS) {
      return;
    }

    setItems((current) => [...current, { productId, quantity: 1 }]);
  }

  function setQuantity(productId: string, quantity: number) {
    setItems((current) =>
      current.map((item) => (item.productId === productId ? { ...item, quantity: Math.max(1, quantity) } : item))
    );
  }

  return (
    <form action={formAction} className="grid max-w-3xl gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">{heading}</h1>
        <Link
          className="inline-flex h-11 items-center rounded-lg border border-[#e5e3f1] px-4 text-sm font-medium text-[#555762] transition hover:bg-[#f7f7fb]"
          href={cancelHref}
        >
          Cancel
        </Link>
      </div>

      {state.status === "error" && !state.lockedFeature ? (
        <p className="m-0 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">{state.message}</p>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={state.fieldErrors?.name} label="Name">
            <input
              className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              defaultValue={bundle?.name}
              maxLength={120}
              name="name"
              placeholder="Headphones + case"
              required
              type="text"
            />
          </Field>
          <Field label="Status">
            <select
              className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              defaultValue={bundle?.status ?? ("ACTIVE" satisfies BundleStatus)}
              name="status"
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </Field>
        </div>
        <Field
          hint="Shown to the shopper beside the saving. Leave it empty and one is written from the rule."
          label="Description"
        >
          <input
            className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
            defaultValue={bundle?.description}
            maxLength={160}
            name="description"
            placeholder={summary}
            type="text"
          />
        </Field>
      </section>

      <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <header className="grid gap-1">
          <h2 className="m-0 text-base font-semibold text-[#252238]">What kind of deal</h2>
          <p className="m-0 text-xs leading-relaxed text-[#77748a]">{summary}</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e4e3ee] p-3">
            <input checked={type === "SET"} name="type" onChange={() => setType("SET")} type="radio" value="SET" />
            <span className="grid gap-0.5">
              <strong className="text-sm">Buy these together</strong>
              <small className="text-xs text-[#77748a]">Every listed product has to be in the cart.</small>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-[#e4e3ee] p-3">
            <input checked={type === "QUANTITY"} name="type" onChange={() => setType("QUANTITY")} type="radio" value="QUANTITY" />
            <span className="grid gap-0.5">
              <strong className="text-sm">Buy N, get M</strong>
              <small className="text-xs text-[#77748a]">Units counted across every listed product.</small>
            </span>
          </label>
        </div>
        {type === "QUANTITY" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field error={state.fieldErrors?.buyQuantity} label="Must buy">
              <input
                className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
                min={1}
                name="buyQuantity"
                onChange={(event) => setBuyQuantity(event.target.value)}
                type="number"
                value={buyQuantity}
              />
            </Field>
            <Field hint="These are the ones discounted." label="Then get">
              <input
                className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
                min={1}
                name="getQuantity"
                onChange={(event) => setGetQuantity(event.target.value)}
                type="number"
                value={getQuantity}
              />
            </Field>
          </div>
        ) : (
          <>
            <input name="buyQuantity" type="hidden" value="0" />
            <input name="getQuantity" type="hidden" value="0" />
          </>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <header className="grid gap-1">
          <h2 className="m-0 text-base font-semibold text-[#252238]">Products</h2>
          <p className="m-0 text-xs leading-relaxed text-[#77748a]">
            {type === "SET"
              ? "All of these must be in the cart, at the quantities below."
              : "Units of any of these count towards the deal."}
          </p>
        </header>
        {state.fieldErrors?.items ? (
          <p className="m-0 text-xs text-rose-600">{state.fieldErrors.items}</p>
        ) : null}
        <div className="grid gap-2">
          {items.map((item) => {
            const product = productsById.get(item.productId);

            return (
              <div className="flex items-center gap-3 rounded-lg border border-[#eceaf4] px-3 py-2" key={item.productId}>
                <input name="itemProductId" type="hidden" value={item.productId} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{product?.title ?? item.productId}</span>
                <span className="text-xs text-[#77748a]">{product ? formatMoney(product.price, currency) : ""}</span>
                {type === "SET" ? (
                  <label className="flex items-center gap-1.5 text-xs text-[#77748a]">
                    Qty
                    <input
                      className="h-9 w-16 rounded-lg border border-[#e4e3ee] px-2 text-sm"
                      min={1}
                      name="itemQuantity"
                      onChange={(event) => setQuantity(item.productId, Number(event.target.value))}
                      type="number"
                      value={item.quantity}
                    />
                  </label>
                ) : (
                  <input name="itemQuantity" type="hidden" value="1" />
                )}
                <button
                  aria-label={`Remove ${product?.title ?? "product"}`}
                  className="rounded-full p-1 text-[#8a8798] hover:bg-[#f4f3f9]"
                  onClick={() => setItems((current) => current.filter((entry) => entry.productId !== item.productId))}
                  type="button"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
          {items.length === 0 ? (
            <p className="m-0 rounded-lg bg-[#f7f7fb] px-4 py-3 text-sm text-[#77748a]">
              No products yet. Add the ones this deal is built from.
            </p>
          ) : null}
        </div>
        {items.length < MAX_BUNDLE_ITEMS ? (
          <label className="flex items-center gap-2 text-sm">
            <Plus aria-hidden="true" className="h-4 w-4 text-[#6d3cf5]" />
            <select
              className="h-11 flex-1 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              onChange={(event) => {
                addItem(event.target.value);
                event.target.value = "";
              }}
              value=""
            >
              <option value="">Add a product</option>
              {unpicked.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title} — {formatMoney(product.price, currency)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <h2 className="m-0 text-base font-semibold text-[#252238]">The discount</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select
              className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              name="discountType"
              onChange={(event) => setDiscountType(event.target.value as BundleDiscountType)}
              value={discountType}
            >
              <option value="PERCENTAGE">Percentage off</option>
              <option value="FIXED">Fixed amount off</option>
            </select>
          </Field>
          <Field
            error={state.fieldErrors?.discountValue}
            hint={
              discountType === "PERCENTAGE"
                ? "100 makes the discounted units free."
                : type === "QUANTITY"
                  ? "Taken off each discounted unit."
                  : "Taken off once per set."
            }
            label={discountType === "PERCENTAGE" ? "Percent off" : `Amount off (${currency})`}
          >
            <input
              className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              min={0}
              name="discountValue"
              onChange={(event) => setDiscountValue(event.target.value)}
              step="0.01"
              type="number"
              value={discountValue}
            />
          </Field>
        </div>
        {preview && preview.saving > 0 ? (
          <p className="m-0 rounded-lg bg-[#f6f3ff] px-4 py-3 text-sm text-[#3d2279]">
            A cart that just qualifies is worth {formatMoney(String(preview.cartValue), currency)} and would save{" "}
            <strong>{formatMoney(String(preview.saving), currency)}</strong>.
          </p>
        ) : null}
        {preview && preview.saving <= 0 && items.length > 0 ? (
          <p className="m-0 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-700">
            As set up, this deal takes nothing off. Check the quantities and the discount.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-[#ecebf3] bg-white p-5">
        <h2 className="m-0 text-base font-semibold text-[#252238]">When it runs</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field hint="Leave empty to start now." label="Starts">
            <input
              className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              defaultValue={toDateInput(bundle?.startsAt)}
              name="startsAt"
              type="date"
            />
          </Field>
          <Field error={state.fieldErrors?.expiresAt} hint="Leave empty to run until switched off." label="Ends">
            <input
              className="h-11 rounded-lg border border-[#e4e3ee] px-3 text-sm"
              defaultValue={toDateInput(bundle?.expiresAt)}
              name="expiresAt"
              type="date"
            />
          </Field>
        </div>
      </section>

      <div>
        <button
          className="inline-flex h-11 items-center rounded-lg bg-[#6d3cf5] px-5 text-sm font-semibold text-white transition hover:bg-[#5b2fe0] disabled:opacity-70"
          disabled={isPending}
          type="submit"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

function Field({
  children,
  error,
  hint,
  label
}: {
  children: React.ReactNode;
  error?: string | undefined;
  hint?: string | undefined;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[#252238]">
      {label}
      {children}
      {hint ? <small className="text-xs font-normal text-[#77748a]">{hint}</small> : null}
      {error ? <small className="text-xs font-normal text-rose-600">{error}</small> : null}
    </label>
  );
}

function toDateInput(value: Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value) || 0);
}
