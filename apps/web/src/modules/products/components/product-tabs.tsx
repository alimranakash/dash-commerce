import Link from "next/link";
import type { ProductListStatus } from "./product-list.types";

type ProductTabsProps = {
  active: ProductListStatus;
  counts: Record<ProductListStatus, number>;
};

const tabs: Array<{ key: ProductListStatus; label: string }> = [
  { key: "all", label: "All" },
  { key: "live", label: "Live" },
  { key: "draft", label: "Draft" },
  { key: "trash", label: "Trash" }
];

export function ProductTabs({ active, counts }: ProductTabsProps) {
  return (
    <nav className="flex items-end gap-5 border-b border-[#ecebf3]" aria-label="Product status">
      {tabs.map((tab) => (
        <Link
          aria-current={active === tab.key ? "page" : undefined}
          className={`relative flex items-center gap-1.5 pb-3 text-xs font-medium transition ${active === tab.key ? "text-[#6d3cf5]" : "text-[#484952] hover:text-[#6d3cf5]"}`}
          href={tab.key === "all" ? "/dashboard/products" : `/dashboard/products?status=${tab.key}`}
          key={tab.key}
        >
          {tab.label}
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] ${tab.key === "live" ? "bg-emerald-50 text-emerald-600" : tab.key === "trash" ? "bg-rose-50 text-rose-500" : tab.key === "draft" ? "bg-amber-50 text-amber-600" : "bg-[#f1f1f5] text-[#555662]"}`}>{counts[tab.key]}</span>
          {active === tab.key ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#7c3aed]" /> : null}
        </Link>
      ))}
    </nav>
  );
}
