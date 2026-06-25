import Link from "next/link";
import type { PurchaseStatus } from "../purchase.schema";

type PurchaseTab = "ALL" | PurchaseStatus;

const tabs: Array<{ label: string; value: PurchaseTab }> = [
  { label: "All", value: "ALL" },
  { label: "Draft", value: "DRAFT" },
  { label: "Ordered", value: "ORDERED" },
  { label: "Received", value: "RECEIVED" },
  { label: "Cancelled", value: "CANCELLED" }
];

type PurchaseTabsProps = {
  active: PurchaseTab;
  counts: Record<"all" | "cancelled" | "draft" | "ordered" | "received", number>;
  search: string | undefined;
};

export function PurchaseTabs({ active, counts, search }: PurchaseTabsProps) {
  return (
    <div className="flex flex-wrap gap-4 border-b border-[#e7e4f4]">
      {tabs.map((tab) => {
        const isActive = active === tab.value;
        const count = counts[countKey(tab.value)];
        const params = new URLSearchParams();
        if (tab.value !== "ALL") params.set("status", tab.value.toLowerCase());
        if (search) params.set("search", search);

        return (
          <Link
            className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-0 pb-3 text-sm transition ${
              isActive ? "border-[#7c3aed] text-[#6d3cf5]" : "border-transparent text-[#30313d] hover:text-[#6d3cf5]"
            }`}
            href={`/dashboard/purchases${params.size ? `?${params.toString()}` : ""}`}
            key={tab.value}
          >
            {tab.label}
            <span className="rounded-full bg-[#f0eef8] px-1.5 py-0.5 text-[11px] text-[#6b6d7a]">{count}</span>
          </Link>
        );
      })}
    </div>
  );
}

function countKey(value: PurchaseTab) {
  if (value === "ALL") return "all";
  return value.toLowerCase() as "cancelled" | "draft" | "ordered" | "received";
}
