import { Search } from "lucide-react";
import Link from "next/link";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";

/**
 * The stages a seller actually sorts their day by, which is coarser than the
 * seven statuses: "waiting on me", "coming back", "settled", "closed".
 */
export type ReturnFilterKey = "all" | "open" | "approved" | "received" | "completed" | "closed";

type ReturnListControlsProps = {
  activeFilter: ReturnFilterKey;
  basePath: string;
  counts: Record<ReturnFilterKey, number>;
  dateFrom: string;
  dateTo: string;
  search: string;
};

const tabs: Array<{ badgeClass: string; key: ReturnFilterKey; label: string }> = [
  { badgeClass: "bg-[#f0f0f3] text-[#555762]", key: "all", label: "All" },
  { badgeClass: "bg-[#fff3d9] text-[#e49a00]", key: "open", label: "Requested" },
  { badgeClass: "bg-[#e7f3ff] text-[#1683ed]", key: "approved", label: "Approved" },
  { badgeClass: "bg-[#f1ebff] text-[#7548f5]", key: "received", label: "Received" },
  { badgeClass: "bg-[#e6f7e8] text-[#159447]", key: "completed", label: "Completed" },
  { badgeClass: "bg-[#ffe8ef] text-[#ef4774]", key: "closed", label: "Closed" }
];

export function matchesReturnFilter(status: string, filter: ReturnFilterKey) {
  if (filter === "all") return true;
  if (filter === "open") return status === "REQUESTED";
  if (filter === "approved") return status === "APPROVED" || status === "IN_TRANSIT";
  if (filter === "received") return status === "RECEIVED";
  if (filter === "completed") return status === "COMPLETED";

  return status === "REJECTED" || status === "CANCELLED";
}

export function parseReturnFilter(value: string): ReturnFilterKey {
  const filters: ReturnFilterKey[] = ["open", "approved", "received", "completed", "closed"];

  return filters.includes(value as ReturnFilterKey) ? (value as ReturnFilterKey) : "all";
}

export function ReturnListControls({
  activeFilter,
  basePath,
  counts,
  dateFrom,
  dateTo,
  search
}: ReturnListControlsProps) {
  return (
    <section className="rounded-xl border border-[#ececf5] bg-white px-5 py-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <nav
          aria-label="Request status filters"
          className="-mb-px flex min-w-0 gap-5 overflow-x-auto border-b border-[#eeeeF5]"
        >
          {tabs.map((tab) => {
            const params = new URLSearchParams();
            if (tab.key !== "all") params.set("status", tab.key);
            if (search) params.set("search", search);
            if (dateFrom) params.set("dateFrom", dateFrom);
            if (dateTo) params.set("dateTo", dateTo);
            const href = params.size ? `${basePath}?${params.toString()}` : basePath;
            const active = activeFilter === tab.key;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-3 text-[13px] font-medium transition ${active ? "border-[#7c3aed] text-[#6d3cf5]" : "border-transparent text-[#30313d] hover:text-[#6d3cf5]"}`}
                href={href}
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
          actionPath={basePath}
          className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto"
        >
          {activeFilter !== "all" ? (
            <input name="status" type="hidden" value={activeFilter} />
          ) : null}
          <input
            aria-label="Search requests"
            className="h-11 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] sm:w-48"
            defaultValue={search}
            name="search"
            placeholder="Search"
            type="search"
          />
          <input
            aria-label="Requests from date"
            className="h-11 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] sm:w-40"
            defaultValue={dateFrom}
            name="dateFrom"
            title="Date from"
            type="date"
          />
          <input
            aria-label="Requests to date"
            className="h-11 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none focus:border-[#8b5cf6] sm:w-40"
            defaultValue={dateTo}
            name="dateTo"
            title="Date to"
            type="date"
          />
          <button
            aria-label="Search requests"
            className="grid h-11 w-full shrink-0 place-items-center rounded-lg bg-[#7548f5] text-white transition hover:bg-[#6436e8] sm:w-11"
            type="submit"
          >
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        </DashboardQueryForm>
      </div>
    </section>
  );
}
