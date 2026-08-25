"use client";

import { Button } from "@dash/ui";
import Link from "next/link";
import { useActionState, useMemo, useState, type ReactNode } from "react";
import type { OrderDetailsActionState } from "../order.actions";

export type OrderFormVariantOption = {
  id: string;
  price: string;
  sku: string | null;
  stockQuantity: number;
  title: string;
};

export type OrderFormProductOption = {
  id: string;
  imageUrl: string | null;
  price: string;
  sku: string | null;
  status: string;
  stockQuantity: number;
  title: string;
  variants: OrderFormVariantOption[];
};

export type OrderFormShippingOption = {
  amount: string;
  id: string;
  name: string;
};

export type OrderFormPaymentOption = {
  isEnabled: boolean;
  name: string;
  type: string;
};

/** One line of a cart the seller is converting, as ids rather than as display text. */
export type OrderFormPrefillLine = {
  price: string;
  productId: string;
  quantity: number;
  /** What the shopper saw it called, so a line that has since gone can be named. */
  title: string;
  variantId: string | null;
};

/**
 * A checkout the customer filled in but never completed, as a starting point.
 *
 * Every field is a default, not a decision: the seller is on the phone to this
 * customer while they read it, and an address or a quantity may well change
 * before the order is saved.
 */
export type OrderCreatePrefill = {
  addressLine1: string;
  addressLine2: string;
  area: string;
  city: string;
  country: string;
  /** Shown so the seller can honour it as a discount; never applied for them. */
  couponCode: string | null;
  customerEmail: string;
  customerName: string;
  customerPhone: string;
  district: string;
  lines: OrderFormPrefillLine[];
  notes: string;
  paymentMethod: string | null;
  postalCode: string;
  shippingRateId: string | null;
  /** The incomplete-order row this came from, so it can be filed as recovered. */
  sourceId: string;
};

type OrderCreateFormProps = {
  action: (state: OrderDetailsActionState, formData: FormData) => Promise<OrderDetailsActionState>;
  cancelHref: string;
  currency: string;
  paymentMethods: OrderFormPaymentOption[];
  prefill?: OrderCreatePrefill | undefined;
  products: OrderFormProductOption[];
  shippingRates: OrderFormShippingOption[];
  /** Whether the store has order SMS switched on at all — the per-order box is pointless otherwise. */
  smsEnabled: boolean;
};

type OrderLine = {
  key: string;
  price: string;
  productId: string;
  quantity: number;
  stockLabel: string;
  title: string;
  variantId: string | null;
};

const initialState: OrderDetailsActionState = {
  status: "idle"
};

export function OrderCreateForm({
  action,
  cancelHref,
  currency,
  paymentMethods,
  prefill,
  products,
  shippingRates,
  smsEnabled
}: OrderCreateFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const resolved = useMemo(
    () => resolvePrefillLines(prefill?.lines ?? [], products),
    [prefill, products]
  );
  const [lines, setLines] = useState<OrderLine[]>(resolved.lines);
  const [search, setSearch] = useState("");
  const [variantChoice, setVariantChoice] = useState<Record<string, string>>({});
  // The zone the shopper picked, when it is still on offer; otherwise the same
  // first-zone default an order typed from scratch gets.
  const startingRate =
    shippingRates.find((rate) => rate.id === prefill?.shippingRateId) ?? shippingRates[0];
  const [shippingRateId, setShippingRateId] = useState(startingRate?.id ?? "");
  const [shippingAmount, setShippingAmount] = useState(
    startingRate ? Number(startingRate.amount).toFixed(2) : "0.00"
  );
  const [discountAmount, setDiscountAmount] = useState("0");
  const [paymentStatus, setPaymentStatus] = useState("PENDING");
  const [paymentMethod, setPaymentMethod] = useState(
    paymentMethods.find((method) => method.type === prefill?.paymentMethod)?.type ??
      paymentMethods.find((method) => method.isEnabled)?.type ??
      paymentMethods[0]?.type ??
      "COD"
  );

  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    const scoped = query
      ? products.filter(
          (product) =>
            product.title.toLowerCase().includes(query) ||
            (product.sku ?? "").toLowerCase().includes(query)
        )
      : products;

    // The list is a picker, not a catalog: showing everything a large store
    // sells would bury the search box under a thousand rows.
    return scoped.slice(0, 40);
  }, [products, search]);

  const subtotal = lines.reduce((sum, line) => sum + Number(line.price || 0) * line.quantity, 0);
  const delivery = Number(shippingAmount || 0);
  const discount = Number(discountAmount || 0);
  const total = subtotal + delivery - discount;
  const isManualPayment = paymentMethod !== "COD";

  function addLine(product: OrderFormProductOption) {
    const variantId = product.variants.length
      ? (variantChoice[product.id] ?? product.variants[0]?.id ?? null)
      : null;
    const variant = product.variants.find((entry) => entry.id === variantId) ?? null;

    if (product.variants.length && !variant) {
      return;
    }

    const key = `${product.id}::${variant?.id ?? ""}`;

    setLines((current) => {
      const existing = current.find((line) => line.key === key);

      // Adding the same option twice means "one more of it", not a second row —
      // and the server merges duplicates anyway, so two rows would only mislead.
      if (existing) {
        return current.map((line) =>
          line.key === key ? { ...line, quantity: line.quantity + 1 } : line
        );
      }

      const stock = variant ? variant.stockQuantity : product.stockQuantity;

      return [
        ...current,
        {
          key,
          price: Number(variant ? variant.price : product.price).toFixed(2),
          productId: product.id,
          quantity: 1,
          stockLabel: `${stock} in stock`,
          title: variant ? `${product.title} - ${variant.title}` : product.title,
          variantId: variant?.id ?? null
        }
      ];
    });
  }

  function updateLine(key: string, patch: Partial<OrderLine>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function removeLine(key: string) {
    setLines((current) => current.filter((line) => line.key !== key));
  }

  function selectShippingRate(rateId: string) {
    setShippingRateId(rateId);

    const rate = shippingRates.find((entry) => entry.id === rateId);

    // The charge stays editable afterwards — picking a zone is a starting point,
    // not a decision, when the seller is quoting a price on the phone.
    setShippingAmount(rate ? Number(rate.amount).toFixed(2) : "0.00");
  }

  return (
    <form action={formAction} className="resource-form compact-form catalog-create-form">
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

      {prefill ? <input name="incompleteOrderId" type="hidden" value={prefill.sourceId} /> : null}

      {state.status === "error" ? <p className="form-error">{state.message}</p> : null}

      {prefill ? (
        <PrefillNotice
          couponCode={prefill.couponCode}
          customerName={prefill.customerName}
          missingLines={resolved.missing}
        />
      ) : null}

      <h2 className="m-0 text-sm font-semibold text-[#292a34]">Products</h2>
      {state.fieldErrors?.items ? (
        <span className="field-error">{state.fieldErrors.items}</span>
      ) : null}

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
                      {product.status === "ACTIVE" ? null : (
                        <span className="ml-2 rounded bg-[#f1f0fa] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7b7c92]">
                          {product.status.toLowerCase()}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-[#7b7c92]">
                      {formatMoney(product.price, currency)} · {product.stockQuantity} in stock
                      {product.sku ? ` · ${product.sku}` : ""}
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

      {lines.length === 0 ? (
        <p className="m-0 rounded-lg border border-dashed border-[#d9d8ea] px-4 py-6 text-center text-xs text-[#7b7c92]">
          No products added yet. Search above and add what the customer is buying.
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
              {lines.map((line) => (
                <tr className="border-t border-[#ececf5]" key={line.key}>
                  <td className="py-2 pr-3">
                    <span className="block text-sm font-medium text-[#292a34]">{line.title}</span>
                    <span className="text-xs text-[#7b7c92]">{line.stockLabel}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-24"
                      inputMode="decimal"
                      onChange={(event) => updateLine(line.key, { price: event.target.value })}
                      type="text"
                      value={line.price}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <input
                      className="w-20"
                      min={1}
                      onChange={(event) =>
                        updateLine(line.key, {
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
                    <button
                      className="text-xs font-semibold text-[#c0392b]"
                      onClick={() => removeLine(line.key)}
                      type="button"
                    >
                      Remove
                    </button>
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
              defaultValue={prefill?.customerName ?? ""}
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
              defaultValue={prefill?.customerPhone ?? ""}
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
              defaultValue={prefill?.customerEmail ?? ""}
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
            defaultValue={prefill?.addressLine1 ?? ""}
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
            defaultValue={prefill?.addressLine2 ?? ""}
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
            <input defaultValue={prefill?.area ?? ""} name="area" placeholder="Area" type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="city">
          <label>
            City
            <input defaultValue={prefill?.city ?? ""} name="city" placeholder="City" type="text" />
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="district">
          <label>
            District
            <input
              defaultValue={prefill?.district ?? ""}
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
              defaultValue={prefill?.postalCode ?? ""}
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
              defaultValue={prefill?.country || "Bangladesh"}
              name="country"
              required
              type="text"
            />
          </label>
        </FieldError>
      </div>

      <h2 className="m-0 mt-2 text-sm font-semibold text-[#292a34]">Delivery &amp; Charges</h2>
      <div className="form-grid">
        <FieldError errors={state.fieldErrors} name="shippingRateId">
          <label>
            Shipping Zone
            <select
              name="shippingRateId"
              onChange={(event) => selectShippingRate(event.target.value)}
              value={shippingRateId}
            >
              <option value="">No shipping zone</option>
              {shippingRates.map((rate) => (
                <option key={rate.id} value={rate.id}>
                  {rate.name} ({formatMoney(rate.amount, currency)})
                </option>
              ))}
            </select>
          </label>
        </FieldError>
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
        <SummaryRow label="Subtotal" value={formatMoney(subtotal, currency)} />
        <SummaryRow label="Delivery" value={formatMoney(delivery, currency)} />
        <SummaryRow label="Discount" value={`- ${formatMoney(discount, currency)}`} />
        <div className="mt-2 flex items-center justify-between border-t border-[#ececf5] pt-2 text-base font-semibold text-[#292a34]">
          <dt>Total</dt>
          <dd className="m-0">{formatMoney(total, currency)}</dd>
        </div>
      </dl>

      <h2 className="m-0 mt-2 text-sm font-semibold text-[#292a34]">Payment &amp; Status</h2>
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
        <FieldError errors={state.fieldErrors} name="paymentStatus">
          <label>
            Payment Status
            <select
              name="paymentStatus"
              onChange={(event) => setPaymentStatus(event.target.value)}
              value={paymentStatus}
            >
              <option value="PENDING">Not paid yet</option>
              <option value="PAID">Already paid</option>
            </select>
          </label>
        </FieldError>
        <FieldError errors={state.fieldErrors} name="status">
          <label>
            Order Status
            <select defaultValue="CONFIRMED" name="status">
              <option value="PENDING">Pending</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="PROCESSING">Processing</option>
              <option value="COMPLETED">Completed</option>
            </select>
          </label>
        </FieldError>
      </div>

      {isManualPayment || paymentStatus === "PAID" ? (
        <div className="form-grid">
          <FieldError errors={state.fieldErrors} name="paymentReference">
            <label>
              Transaction ID
              <input name="paymentReference" placeholder="bKash / Nagad trx id" type="text" />
            </label>
          </FieldError>
          <FieldError errors={state.fieldErrors} name="paymentNote">
            <label>
              Payment Note
              <input name="paymentNote" placeholder="Optional" type="text" />
            </label>
          </FieldError>
        </div>
      ) : null}

      <FieldError errors={state.fieldErrors} name="notes">
        <label>
          Order Note
          <textarea
            defaultValue={prefill?.notes ?? ""}
            name="notes"
            placeholder="Delivery instructions for this order"
            rows={3}
          />
        </label>
      </FieldError>

      {smsEnabled ? (
        <label className="flex items-center gap-2 text-sm font-normal text-[#4b4c5f]">
          <input className="h-4 w-4" defaultChecked name="sendSms" type="checkbox" />
          Send the order confirmation SMS to this customer
        </label>
      ) : null}

      <div className="form-actions">
        <Link className="catalog-cancel-button" href={cancelHref}>
          Cancel
        </Link>
        <Button
          className="catalog-submit-button"
          disabled={isPending || lines.length === 0}
          type="submit"
        >
          {isPending ? "Creating..." : "Create Order"}
        </Button>
      </div>
    </form>
  );
}

function PrefillNotice({
  couponCode,
  customerName,
  missingLines
}: {
  couponCode: string | null;
  customerName: string;
  missingLines: string[];
}) {
  return (
    <div className="rounded-lg border border-[#ded5ff] bg-[#f7f4ff] px-4 py-3 text-sm text-[#4b3fd6]">
      <p className="m-0 font-semibold">
        Prefilled from a checkout {customerName || "this customer"} did not finish.
      </p>
      <p className="m-0 mt-1 text-xs text-[#5f57b8]">
        Check every field with them before saving — none of it was confirmed, and the prices are the
        ones they were quoted at the time.
      </p>
      {missingLines.length ? (
        <p className="m-0 mt-2 text-xs font-semibold text-[#a3203a]">
          Not added back — no longer in your catalog: {missingLines.join(", ")}.
        </p>
      ) : null}
      {couponCode ? (
        <p className="m-0 mt-2 text-xs">
          They had entered coupon <strong>{couponCode}</strong>. Enter the discount by hand below if
          you want to honour it.
        </p>
      ) : null}
    </div>
  );
}

/**
 * Cart lines, matched back onto the catalog.
 *
 * A snapshot can be weeks old, so a product may have been archived or deleted
 * since — and a line naming a variant that no longer exists is not the same
 * line. Those are dropped rather than guessed at, and counted so the form can
 * say so: a seller must not quietly ship a shorter order than the customer
 * chose.
 */
function resolvePrefillLines(
  prefillLines: OrderFormPrefillLine[],
  products: OrderFormProductOption[]
) {
  const lines: OrderLine[] = [];
  const missing: string[] = [];

  for (const line of prefillLines) {
    const product = products.find((entry) => entry.id === line.productId);
    const variant = line.variantId
      ? (product?.variants.find((entry) => entry.id === line.variantId) ?? null)
      : null;

    if (!product || (line.variantId && !variant)) {
      missing.push(line.title || "an item");
      continue;
    }

    const key = `${product.id}::${variant?.id ?? ""}`;
    const quantity = Math.max(1, Math.floor(line.quantity) || 1);
    const existing = lines.find((entry) => entry.key === key);

    if (existing) {
      existing.quantity += quantity;
      continue;
    }

    lines.push({
      key,
      price: Number(line.price || (variant ? variant.price : product.price)).toFixed(2),
      productId: product.id,
      quantity,
      stockLabel: `${variant ? variant.stockQuantity : product.stockQuantity} in stock`,
      title: variant ? `${product.title} - ${variant.title}` : product.title,
      variantId: variant?.id ?? null
    });
  }

  return { lines, missing };
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-[#4b4c5f]">
      <dt>{label}</dt>
      <dd className="m-0">{value}</dd>
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

function formatMoney(value: string | number, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value) || 0);
}
