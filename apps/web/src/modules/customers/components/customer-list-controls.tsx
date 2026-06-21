import { FileSearch, Search } from "lucide-react";
import Link from "next/link";

export type CustomerFilterKey = "all" | "recurring" | "one-time";

type CustomerListControlsProps = {
  activeFilter: CustomerFilterKey;
  search: string;
};

const tabs: Array<{ badgeClass: string; key: CustomerFilterKey; label: string }> = [
  { badgeClass: "bg-[#f0f0f3] text-[#555762]", key: "all", label: "All" },
  { badgeClass: "bg-[#ffe8ed] text-[#f05268]", key: "recurring", label: "Recurring" },
  { badgeClass: "bg-[#e5f8f2] text-[#119c73]", key: "one-time", label: "One-time" }
];

export function CustomerListControls({ activeFilter, search }: CustomerListControlsProps) {
  return (
    <section className="flex min-h-[520px] flex-col rounded-xl border border-[#ececf5] bg-white px-6 py-6 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <nav aria-label="Customer filters" className="-mb-px flex min-w-0 gap-5 overflow-x-auto border-b border-[#eeeef5]">
          {tabs.map((tab) => {
            const params = new URLSearchParams();
            if (tab.key !== "all") params.set("type", tab.key);
            if (search) params.set("search", search);
            const active = activeFilter === tab.key;

            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 pb-3 text-[13px] font-medium transition ${active ? "border-[#7c3aed] text-[#6d3cf5]" : "border-transparent text-[#30313d] hover:text-[#6d3cf5]"}`}
                href={`/dashboard/customers${params.size ? `?${params.toString()}` : ""}`}
                key={tab.key}
              >
                {tab.label}
                <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab.badgeClass}`}>0</span>
              </Link>
            );
          })}
        </nav>

        <form className="flex w-full gap-3 sm:w-auto" method="get">
          {activeFilter !== "all" ? <input name="type" type="hidden" value={activeFilter} /> : null}
          <input
            aria-label="Search customers"
            className="h-11 min-w-0 flex-1 rounded-lg border border-[#e5e3f1] bg-white px-3.5 text-sm outline-none placeholder:text-[#a2a3b0] focus:border-[#8b5cf6] sm:w-56"
            defaultValue={search}
            name="search"
            placeholder="Search"
            type="search"
          />
          <button aria-label="Search customers" className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[#7548f5] text-white transition hover:bg-[#6436e8]" type="submit">
            <Search aria-hidden="true" className="h-4 w-4" />
          </button>
        </form>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="mb-5 grid h-28 w-28 place-items-center rounded-xl bg-[#f5f3ff] text-[#8b5cf6]">
          <FileSearch aria-hidden="true" className="h-20 w-20" strokeWidth={1.5} />
        </div>
        <h2 className="m-0 text-xl font-semibold text-[#20212a]">No Customers Found</h2>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#85869a]">
          You&apos;re yet to receive any customers in your store. Keep promoting your store to bring in your first customer.
        </p>
      </div>
    </section>
  );
}
