"use client";

import { CalendarDays } from "lucide-react";
import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";

type DiscountType = "percentage" | "fixed" | "products" | "shipping";
type CouponStatus = "active" | "inactive";

const discountOptions: Array<{ label: string; value: DiscountType }> = [
  { label: "Percentage Discount", value: "percentage" },
  { label: "Fixed Cart Discount", value: "fixed" },
  { label: "Free Products", value: "products" },
  { label: "Free Shipping", value: "shipping" }
];

export function CouponForm() {
  const [discountType, setDiscountType] = useState<DiscountType>("percentage");
  const [status, setStatus] = useState<CouponStatus>("active");
  const [message, setMessage] = useState("");

  function submitCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Coupons cannot be saved yet — coupon storage is not connected. Nothing was created.");
  }

  const amountDisabled = discountType === "shipping";

  return (
    <form className="grid gap-5" onSubmit={submitCoupon}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="m-0 text-[1.65rem] font-semibold leading-tight">Create Coupon</h1>
        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Coupon status"
            className="h-11 rounded-lg border border-[#7c3aed] bg-white px-3 text-sm font-medium text-[#6d3cf5] outline-none focus:ring-2 focus:ring-[#7c3aed]/10"
            name="status"
            onChange={(event) => setStatus(event.target.value as CouponStatus)}
            value={status}
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button className="h-11 rounded-lg bg-[#7548f5] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6436e8]" type="submit">
            Save as {status === "active" ? "Active" : "Inactive"}
          </button>
        </div>
      </div>

      {message ? <p className="m-0 rounded-lg border border-[#f0e3c4] bg-[#fdf8ec] px-4 py-3 text-sm text-[#8a6a1f]">{message}</p> : null}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="grid gap-5">
          <CouponCard title="General">
            <CouponField label="Name">
              <CouponInput name="name" placeholder="Coupon Name" type="text" />
            </CouponField>
            <CouponField label="Code">
              <CouponInput name="code" placeholder="Coupon Code" type="text" />
            </CouponField>
          </CouponCard>

          <CouponCard title="Offers">
            <fieldset className="grid gap-3 border-0 p-0">
              <legend className="mb-2 text-sm font-medium text-[#292a34]">Discount Type</legend>
              {discountOptions.map((option) => (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#30313d]" key={option.value}>
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
            <CouponField label="Offer Amount">
              {discountType === "products" ? (
                <CouponPrefixedInput
                  name="offerAmount"
                  placeholder="Search product or enter quantity"
                  leading="Qty"
                  type="search"
                />
              ) : (
                <CouponPrefixedInput
                  disabled={amountDisabled}
                  min="0"
                  name="offerAmount"
                  placeholder={amountDisabled ? "Not required for free shipping" : "0"}
                  leading={discountType === "percentage" ? "%" : discountType === "fixed" ? "$" : null}
                  step={discountType === "percentage" ? "1" : "0.01"}
                  type="number"
                />
              )}
            </CouponField>
          </CouponCard>
        </div>

        <CouponCard title="Conditions">
          <CouponField label="Discount applies to specific products?">
            <CouponInput name="products" placeholder="Search for products" type="search" />
          </CouponField>
          <CouponField label="Minimum Spend">
            <CouponPrefixedInput leading="$" min="0" name="minimumSpend" step="0.01" type="number" />
          </CouponField>
          <CouponField label="Maximum Spend">
            <CouponPrefixedInput leading="$" min="0" name="maximumSpend" step="0.01" type="number" />
          </CouponField>
          <CouponField label="Start Date">
            <CouponPrefixedInput leading={<CalendarDays aria-hidden="true" className="h-4 w-4" />} name="startDate" type="date" />
          </CouponField>
          <CouponField label="End Date">
            <CouponPrefixedInput leading={<CalendarDays aria-hidden="true" className="h-4 w-4" />} name="endDate" type="date" />
          </CouponField>
        </CouponCard>
      </div>
    </form>
  );
}

function CouponCard({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[#ececf5] bg-white shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <header className="border-b border-[#ececf5] px-5 py-5"><h2 className="m-0 text-base font-semibold">{title}</h2></header>
      <div className="grid gap-5 p-5">{children}</div>
    </section>
  );
}

function CouponField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-[#292a34]">
      {label}
      {children}
    </label>
  );
}

const couponInputClass = "h-12 w-full rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm font-normal text-[#292a34] outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 disabled:cursor-not-allowed disabled:bg-[#f7f7fa] disabled:text-[#92939e]";

function CouponInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${couponInputClass} ${props.className ?? ""}`} />;
}

function CouponPrefixedInput({ leading, ...props }: InputHTMLAttributes<HTMLInputElement> & { leading: ReactNode | null }) {
  return (
    <div className={`flex h-12 w-full overflow-hidden rounded-lg border border-[#e5e3f1] bg-white focus-within:border-[#8b5cf6] focus-within:ring-2 focus-within:ring-[#7c3aed]/10 ${props.disabled ? "bg-[#f7f7fa] opacity-70" : ""}`}>
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
