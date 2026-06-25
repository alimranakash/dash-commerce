import { Search } from "lucide-react";
import Link from "next/link";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";

export type OrderFilterKey = "all" | "pending" | "processing" | "completed" | "cancelled" | "on-hold" | "partially-refunded" | "refunded";

type OrderListControlsProps = {
  activeFilter: OrderFilterKey;
  counts: Record<OrderFilterKey, number>;
  dateRange: string;
  search: string;
};

const tabs: Array<{ badgeClass: string; key: OrderFilterKey; label: string }> = [
  { badgeClass: "bg-[#f0f0f3] text-[#555762]", key: "all", label: "All" },
  { badgeClass: "bg-[#fff3d9] text-[#e49a00]", key: "pending", label: "Pending" },
  { badgeClass: "bg-[#e7f3ff] text-[#1683ed]", key: "processing", label: "Processing" },
  { badgeClass: "bg-[#e6f7e8] text-[#159447]", key: "completed", label: "Completed" },
  { badgeClass: "bg-[#ffe8ef] text-[#ef4774]", key: "cancelled", label: "Cancelled" },
  { badgeClass: "bg-[#eeeeff] text-[#6868ef]", key: "on-hold", label: "On Hold" },
  { badgeClass: "bg-[#fff0e2] text-[#ee8a2d]", key: "partially-refunded", label: "Partially Refunded" },
  { badgeClass: "bg-[#ffe8e8] text-[#ef5050]", key: "refunded", label: "Refunded" }
];

export function OrderListControls({ activeFilter, counts, dateRange, search }: OrderListControlsProps) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <nav aria-label="Order status filters" className="-mb-px flex min-w-0 gap-5 overflow-x-auto border-b border-[#eeeeF5]">
          {tabs.map((tab) => {
            const params = new URLSearchParams();
            if (tab.key !== "all") params.set("status", tab.key);
            if (search) params.set("search", search);
            if (dateRange) params.set("dateRange", dateRange);
            const href = params.size ? `/dashboard/orders?${params.toString()}` : "/dashboard/orders";
            const active = activeFilter === tab.key;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-3 text-[13px] font-medium transition ${active ? "border-[#7c3aed] text-[#6d3cf5]" : "border-transparent text-[#30313d] hover:text-[#6d3cf5]"}`}
                href={href}
                key={tab.key}
              >
                {tab.label}
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab.badgeClass}`}>
                  {counts[tab.key]}
                </span>
              </Link>
            );
          })}
        </nav>

        <DashboardQueryForm actionPath="/dashboard/orders" className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          {activeFilter !== "all" ? <input name="status" type="hidden" value={activeFilter} /> : null}
          <input
            aria-label="Search orders"
            className="h-11 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] sm:w-48"
            defaultValue={search}
            name="search"
            placeholder="Search"
            type="search"
          />
          <input
            aria-label="Order date range"
            className="h-11 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] sm:w-56"
            defaultValue={dateRange}
            name="dateRange"
            placeholder="eg. 12 Sep - 28 Oct 2025"
            type="text"
          />
          <button aria-label="Search orders" className="grid h-11 w-full shrink-0 place-items-center rounded-lg bg-[#7548f5] text-white transition hover:bg-[#6436e8] sm:w-11" type="submit">
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        </DashboardQueryForm>
      </div>
    </section>
  );
}
