import { Search } from "lucide-react";
import Link from "next/link";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";

export type AbandonedCartFilterKey = "all" | "not-contacted" | "contacted" | "recovered" | "clean";

type AbandonedCartListControlsProps = {
  activeFilter: AbandonedCartFilterKey;
  counts: Record<Exclude<AbandonedCartFilterKey, "clean">, number>;
  dateRange: string;
  search: string;
};

const tabs: Array<{ badgeClass?: string; key: AbandonedCartFilterKey; label: string }> = [
  { badgeClass: "bg-[#f0f0f3] text-[#555762]", key: "all", label: "All" },
  { badgeClass: "bg-[#ffe8ed] text-[#f05268]", key: "not-contacted", label: "Not Contacted" },
  { badgeClass: "bg-[#eeeaff] text-[#7357e8]", key: "contacted", label: "Contacted" },
  { badgeClass: "bg-[#e5f8f2] text-[#119c73]", key: "recovered", label: "Recovered" },
  { key: "clean", label: "Clean" }
];

export function AbandonedCartListControls({ activeFilter, counts, dateRange, search }: AbandonedCartListControlsProps) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white px-6 py-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <nav aria-label="Abandoned cart filters" className="-mb-px flex min-w-0 gap-5 overflow-x-auto border-b border-[#eeeef5]">
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
                href={`/dashboard/abandoned-cart${params.size ? `?${params.toString()}` : ""}`}
                key={tab.key}
              >
                {tab.label}
                {tab.badgeClass ? <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab.badgeClass}`}>{counts[tab.key as Exclude<AbandonedCartFilterKey, "clean">]}</span> : null}
              </Link>
            );
          })}
        </nav>

        <DashboardQueryForm actionPath="/dashboard/abandoned-cart" className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto">
          {activeFilter !== "all" ? <input name="status" type="hidden" value={activeFilter} /> : null}
          <input
            aria-label="Search abandoned carts"
            className="h-11 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] sm:w-48"
            defaultValue={search}
            name="search"
            placeholder="Search"
            type="search"
          />
          <input
            aria-label="Abandoned cart date range"
            className="h-11 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] sm:w-56"
            defaultValue={dateRange}
            name="dateRange"
            placeholder="eg. 22 May - 21 Jun 2026"
            type="text"
          />
          <button aria-label="Search abandoned carts" className="grid h-11 w-full shrink-0 place-items-center rounded-lg bg-[#7548f5] text-white transition hover:bg-[#6436e8] sm:w-11" type="submit">
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        </DashboardQueryForm>
      </div>

    </section>
  );
}
