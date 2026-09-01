"use client";

import { CalendarDays } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useUpgradePrompt } from "../../billing/components/plan-upgrade-provider";
import type { CouponActionState } from "../coupon.actions";
import type { CouponDiscountType, CouponStatus } from "../coupon.schema";

/**
 * "Free Products" is deliberately absent from this list. Handing a shopper a
 * gift item means writing an extra line onto the order, which the checkout
 * pipeline does not do yet — offering it here would be a control that silently
 * did nothing.
 */
const discountOptions: Array<{ label: string; value: CouponDiscountType }> = [
  { label: "Percentage Discount", value: "PERCENTAGE" },
  { label: "Fixed Cart Discount", value: "FIXED_CART" },
  { label: "Free Shipping", value: "FREE_SHIPPING" }
];

export type CouponFormValue = {
  code?: string;
  description?: string | null;
  discountType?: CouponDiscountType;
  discountValue?: string;
  expiresAt?: Date | null;
  maxDiscountAmount?: string | null;
  maxSubtotal?: string | null;
  minSubtotal?: string | null;
  name?: string;
  startsAt?: Date | null;
  status?: CouponStatus;
  usageLimitPerCustomer?: number | null;
  usageLimitTotal?: number | null;
};

type CouponFormProps = {
  action: (state: CouponActionState, formData: FormData) => Promise<CouponActionState>;
  cancelHref: string;
  coupon?: CouponFormValue;
  currency: string;
  heading: string;
};

const initialState: CouponActionState = {
  status: "idle"
};

export function CouponForm({ action, cancelHref, coupon, currency, heading }: CouponFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { openUpgrade } = useUpgradePrompt();
  const [discountType, setDiscountType] = useState<CouponDiscountType>(
    coupon?.discountType ?? "PERCENTAGE"
  );

  // A plan refusal opens the shared upgrade dialog rather than reading as a
  // validation error the seller could fix by editing the fields.
  useEffect(() => {
    openUpgrade(state.lockedFeature);
  }, [openUpgrade, state]);
  const [status, setStatus] = useState<CouponStatus>(coupon?.status ?? "ACTIVE");

  const isPercentage = discountType === "PERCENTAGE";
  const isFreeShipping = discountType === "FREE_SHIPPING";
  const money = currencySymbol(currency);

  return (
    <form action={formAction} className="grid gap-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">{heading}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            className="inline-flex h-11 items-center rounded-lg border border-[#e5e3f1] px-4 text-sm font-medium text-[#555762] transition hover:bg-[#f7f7fb]"
            href={cancelHref}
          >
            Cancel
          </Link>
          <select
            aria-label="Coupon status"
            className="h-11 rounded-lg border border-[#7c3aed] bg-white px-3 text-sm font-medium text-[#6d3cf5] outline-none focus:ring-2 focus:ring-[#7c3aed]/10"
            name="status"
            onChange={(event) => setStatus(event.target.value as CouponStatus)}
            value={status}
          >
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <button
            className="h-11 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6436e8] disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isPending}
            type="submit"
          >
            {isPending ? "Saving…" : `Save as ${status === "ACTIVE" ? "Active" : "Inactive"}`}
          </button>
        </div>
      </div>

      {state.status === "error" && !state.lockedFeature ? (
        <p
          aria-live="polite"
          className="m-0 rounded-lg border border-[#f5c9d0] bg-[#fdf2f4] px-4 py-3 text-sm text-[#b3273f]"
        >
          {state.message}
        </p>
      ) : null}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="grid gap-5">
          <CouponCard title="General">
            <CouponField errors={state.fieldErrors} label="Name" name="name">
              <CouponInput
                defaultValue={coupon?.name ?? ""}
                name="name"
                placeholder="Coupon Name"
                required
                type="text"
              />
            </CouponField>
            <CouponField
              errors={state.fieldErrors}
              hint="Shoppers type this at checkout. Letters, digits, dashes and underscores."
              label="Code"
              name="code"
            >
              <CouponInput
                autoCapitalize="characters"
                className="uppercase"
                defaultValue={coupon?.code ?? ""}
                name="code"
                placeholder="EID25"
                required
                type="text"
              />
            </CouponField>
            <CouponField errors={state.fieldErrors} label="Description" name="description">
              <textarea
                className={`${couponInputClass} h-24 resize-y py-3`}
                defaultValue={coupon?.description ?? ""}
                name="description"
                placeholder="Internal note about this coupon"
              />
            </CouponField>
          </CouponCard>

          <CouponCard title="Offers">
            <fieldset className="grid gap-3 border-0 p-0">
              <legend className="mb-2 text-sm font-medium text-[#292a34]">Discount Type</legend>
              {discountOptions.map((option) => (
                <label
                  className="flex cursor-pointer items-center gap-2.5 text-sm text-[#30313d]"
                  key={option.value}
                >
                  <input
                    checked={discountType === option.value}
                    className="h-4 w-4 accent-[#7548f5]"
                    name="discountType"
                    onChange={() => setDiscountType(option.value)}
                    type="radio"
                    value={option.value}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>

            <CouponField errors={state.fieldErrors} label="Offer Amount" name="discountValue">
              <CouponPrefixedInput
                defaultValue={coupon?.discountValue ?? ""}
                disabled={isFreeShipping}
                leading={isPercentage ? "%" : money}
                max={isPercentage ? "100" : undefined}
                min="0"
                name="discountValue"
                placeholder={isFreeShipping ? "Not required for free shipping" : "0"}
                step={isPercentage ? "1" : "0.01"}
                type="number"
              />
            </CouponField>

            {/* Only percentages can scale with the cart, so only they need a ceiling. */}
            {isPercentage ? (
              <CouponField
                errors={state.fieldErrors}
                hint="Optional ceiling on what this coupon can take off."
                label="Maximum Discount"
                name="maxDiscountAmount"
              >
                <CouponPrefixedInput
                  defaultValue={coupon?.maxDiscountAmount ?? ""}
                  leading={money}
                  min="0"
                  name="maxDiscountAmount"
                  placeholder="No limit"
                  step="0.01"
                  type="number"
                />
              </CouponField>
            ) : null}
          </CouponCard>
        </div>

        <CouponCard title="Conditions">
          <CouponField errors={state.fieldErrors} label="Minimum Spend" name="minSubtotal">
            <CouponPrefixedInput
              defaultValue={coupon?.minSubtotal ?? ""}
              leading={money}
              min="0"
              name="minSubtotal"
              placeholder="No minimum"
              step="0.01"
              type="number"
            />
          </CouponField>
          <CouponField errors={state.fieldErrors} label="Maximum Spend" name="maxSubtotal">
            <CouponPrefixedInput
              defaultValue={coupon?.maxSubtotal ?? ""}
              leading={money}
              min="0"
              name="maxSubtotal"
              placeholder="No maximum"
              step="0.01"
              type="number"
            />
          </CouponField>
          <CouponField
            errors={state.fieldErrors}
            hint="How many times this code may be used across the whole store."
            label="Total Usage Limit"
            name="usageLimitTotal"
          >
            <CouponInput
              defaultValue={coupon?.usageLimitTotal ?? ""}
              min="1"
              name="usageLimitTotal"
              placeholder="Unlimited"
              step="1"
              type="number"
            />
          </CouponField>
          <CouponField
            errors={state.fieldErrors}
            hint="Counted per phone number."
            label="Usage Limit Per Customer"
            name="usageLimitPerCustomer"
          >
            <CouponInput
              defaultValue={coupon?.usageLimitPerCustomer ?? ""}
              min="1"
              name="usageLimitPerCustomer"
              placeholder="Unlimited"
              step="1"
              type="number"
            />
          </CouponField>
          <CouponField errors={state.fieldErrors} label="Start Date" name="startsAt">
            <CouponPrefixedInput
              defaultValue={toDateInputValue(coupon?.startsAt)}
              leading={<CalendarDays aria-hidden="true" className="h-4 w-4" />}
              name="startsAt"
              type="date"
            />
          </CouponField>
          <CouponField
            errors={state.fieldErrors}
            hint="The coupon stays valid through the end of this day."
            label="End Date"
            name="expiresAt"
          >
            <CouponPrefixedInput
              defaultValue={toDateInputValue(coupon?.expiresAt)}
              leading={<CalendarDays aria-hidden="true" className="h-4 w-4" />}
              name="expiresAt"
              type="date"
            />
          </CouponField>
        </CouponCard>
      </div>
    </form>
  );
}

/**
 * Stored dates are UTC day boundaries (see `couponWriteData`), so the calendar
 * value has to be read back in UTC too — a local-time read would show the
 * previous day for anyone east of Greenwich, Bangladesh included.
 */
function toDateInputValue(date: Date | null | undefined) {
  return date ? date.toISOString().slice(0, 10) : "";
}

function currencySymbol(currency: string) {
  const parts = new Intl.NumberFormat("en", { currency, style: "currency" }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? currency;
}

function CouponCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="border-b border-[#ececf5] px-5 py-5">
        <h2 className="m-0 text-base font-semibold">{title}</h2>
      </header>
      <div className="grid gap-5 p-5">{children}</div>
    </section>
  );
}

function CouponField({
  children,
  errors,
  hint,
  label,
  name
}: {
  children: ReactNode;
  errors: Record<string, string> | undefined;
  hint?: string;
  label: string;
  name: string;
}) {
  const error = errors?.[name];

  return (
    <label className="grid gap-2 text-sm font-medium text-[#292a34]">
      {label}
      {children}
      {error ? (
        <span className="text-xs font-normal text-[#b3273f]">{error}</span>
      ) : hint ? (
        <span className="text-xs font-normal text-[#85869a]">{hint}</span>
      ) : null}
    </label>
  );
}

const couponInputClass =
  "h-12 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:cursor-not-allowed disabled:bg-[#f7f7fa] disabled:text-[#92939e]";

function CouponInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${couponInputClass} ${props.className ?? ""}`} />;
}

function CouponPrefixedInput({
  leading,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { leading: ReactNode | null }) {
  return (
    <div
      className={`flex h-12 w-full overflow-hidden rounded-lg border border-[#e5e3f1] bg-white focus-within:border-[#8b5cf6] focus-within:ring-2 focus-within:ring-[#7c3aed]/10 ${props.disabled ? "bg-[#f7f7fa] opacity-70" : ""}`}
    >
      {leading ? (
        <span className="grid min-w-12 shrink-0 place-items-center border-r border-[#e5e3f1] bg-[#fafaff] px-3 text-xs font-medium text-[#555762]">
          {leading}
        </span>
      ) : null}
      <input
        {...props}
        className={`h-full min-w-0 flex-1 border-0 bg-transparent px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] disabled:cursor-not-allowed ${props.className ?? ""}`}
      />
    </div>
  );
}
