import { FileText, Plus, Search } from "lucide-react";
import Link from "next/link";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import type { CouponRedemptionState, CouponView } from "../coupon.service";
import { CouponRowActions } from "./coupon-row-actions";

export type CouponFilterKey = "all" | "active" | "inactive";

type CouponListControlsProps = {
  activeFilter: CouponFilterKey;
  counts: { active: number; all: number; inactive: number };
  coupons: CouponView[];
  currency: string;
  dateRange: string;
  search: string;
};

const tabs: Array<{ badgeClass: string; key: CouponFilterKey; label: string }> = [
  { badgeClass: "bg-[#f0f0f3] text-[#555762]", key: "all", label: "All" },
  { badgeClass: "bg-[#e5f8f2] text-[#119c73]", key: "active", label: "Active" },
  { badgeClass: "bg-[#ffe8ed] text-[#f05268]", key: "inactive", label: "Inactive" }
];

/**
 * How a derived state reads on a row. `ACTIVE` alone means the code will be
 * accepted today; everything else says why it will not be.
 */
const stateBadges: Record<CouponRedemptionState, { className: string; label: string }> = {
  ACTIVE: { className: "bg-[#e5f8f2] text-[#119c73]", label: "Active" },
  EXPIRED: { className: "bg-[#f0f0f3] text-[#555762]", label: "Expired" },
  INACTIVE: { className: "bg-[#ffe8ed] text-[#f05268]", label: "Inactive" },
  SCHEDULED: { className: "bg-[#eef2ff] text-[#4f56d3]", label: "Scheduled" },
  USED_UP: { className: "bg-[#fdf3e4] text-[#a9741c]", label: "Used up" }
};

export function CouponListControls({
  activeFilter,
  counts,
  coupons,
  currency,
  dateRange,
  search
}: CouponListControlsProps) {
  return (
    <section className="flex min-h-[580px] flex-col rounded-xl border border-[#ececf5] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <nav
          aria-label="Coupon filters"
          className="-mb-px flex min-w-0 gap-5 overflow-x-auto border-b border-[#eeeef5]"
        >
          {tabs.map((tab) => {
            const params = new URLSearchParams();
            if (tab.key !== "all") params.set("status", tab.key);
            if (search) params.set("search", search);
            if (dateRange) params.set("dateRange", dateRange);
            const active = activeFilter === tab.key;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-3 text-[13px] font-medium transition ${active ? "border-[#7c3aed] text-[#6d3cf5]" : "border-transparent text-[#30313d] hover:text-[#6d3cf5]"}`}
                href={`/dashboard/coupons${params.size ? `?${params.toString()}` : ""}`}
                key={tab.key}
              >
                {tab.label}
                <span
                  className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab.badgeClass}`}
                >
                  {counts[tab.key]}
                </span>
              </Link>
            );
          })}
        </nav>

        <DashboardQueryForm
          actionPath="/dashboard/coupons"
          className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto"
        >
          {activeFilter !== "all" ? <input name="status" type="hidden" value={activeFilter} /> : null}
          <input
            aria-label="Search coupons"
            className="h-11 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] sm:w-48"
            defaultValue={search}
            name="search"
            placeholder="Search"
            type="search"
          />
          <input
            aria-label="Coupon date range"
            className="h-11 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] sm:w-56"
            defaultValue={dateRange}
            name="dateRange"
            placeholder="eg. 22 May - 21 Jun 2026"
            type="text"
          />
          <button
            aria-label="Search coupons"
            className="grid h-11 w-full shrink-0 place-items-center rounded-lg bg-[#7548f5] text-white transition hover:bg-[#6436e8] sm:w-11"
            type="submit"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        </DashboardQueryForm>
      </div>

      {coupons.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
          <div className="mb-6 grid h-32 w-32 place-items-center rounded-2xl bg-[#f3efff] text-[#7950f2]">
            <FileText
              aria-hidden="true"
              className="h-24 w-24"
              fill="#8b5cf6"
              stroke="white"
              strokeWidth={1.5}
            />
          </div>
          <h2 className="m-0 text-xl font-semibold text-[#20212a]">No coupons found</h2>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#85869a]">
            {search || dateRange || activeFilter !== "all"
              ? "No coupons match these filters. Try clearing the search."
              : "All type of Coupons activities will appear here once they occur."}
          </p>
          <Link
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-[#7c3aed] px-4 py-2.5 text-sm font-medium text-[#6d3cf5] hover:bg-[#f7f3ff]"
            href="/dashboard/coupons/new"
          >
            <Plus aria-hidden="true" className="h-4 w-4" /> Add Coupon
          </Link>
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#eeeef5] text-[11px] uppercase tracking-wide text-[#85869a]">
                <th className="py-3 pr-4 font-medium">Code</th>
                <th className="py-3 pr-4 font-medium">Discount</th>
                <th className="py-3 pr-4 font-medium">Usage</th>
                <th className="py-3 pr-4 font-medium">Validity</th>
                <th className="py-3 pr-4 font-medium">Status</th>
                <th className="py-3 pl-4 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const badge = stateBadges[coupon.redemptionState];

                return (
                  <tr className="border-b border-[#f4f4f9] align-middle" key={coupon.id}>
                    <td className="py-4 pr-4">
                      <Link
                        className="font-semibold text-[#6d3cf5] hover:underline"
                        href={`/dashboard/coupons/${coupon.id}`}
                      >
                        {coupon.code}
                      </Link>
                      <p className="m-0 mt-0.5 text-xs text-[#85869a]">{coupon.name}</p>
                    </td>
                    <td className="py-4 pr-4 text-[#30313d]">
                      {formatDiscount(coupon, currency)}
                    </td>
                    <td className="py-4 pr-4 text-[#30313d]">
                      {coupon.usedCount}
                      {coupon.usageLimitTotal === null ? "" : ` / ${coupon.usageLimitTotal}`}
                    </td>
                    <td className="py-4 pr-4 text-xs text-[#555762]">{formatValidity(coupon)}</td>
                    <td className="py-4 pr-4">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="py-4 pl-4">
                      <CouponRowActions
                        code={coupon.code}
                        couponId={coupon.id}
                        status={coupon.status}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function formatDiscount(coupon: CouponView, currency: string) {
  if (coupon.discountType === "FREE_SHIPPING") {
    return "Free shipping";
  }

  if (coupon.discountType === "PERCENTAGE") {
    const cap = coupon.maxDiscountAmount
      ? ` (max ${formatMoney(coupon.maxDiscountAmount, currency)})`
      : "";

    return `${trimAmount(coupon.discountValue)}% off${cap}`;
  }

  return `${formatMoney(coupon.discountValue, currency)} off`;
}

function formatValidity(coupon: CouponView) {
  if (!coupon.startsAt && !coupon.expiresAt) {
    return "Always";
  }

  const from = coupon.startsAt ? formatDate(coupon.startsAt) : "Now";
  const to = coupon.expiresAt ? formatDate(coupon.expiresAt) : "No end";

  return `${from} → ${to}`;
}

/**
 * Rendered in UTC to match how the boundaries were stored, so a coupon that
 * expires "on the 30th" does not read as the 31st for a reader in Dhaka.
 */
function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

function formatMoney(amount: string, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(amount));
}

/** `10.00` reads better as `10` on a percentage. */
function trimAmount(amount: string) {
  return String(Number(amount));
}
