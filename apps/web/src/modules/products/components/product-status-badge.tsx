"use client";

import { ChevronDown } from "lucide-react";
import type { ProductListItem } from "./product-list.types";

type ProductStatusBadgeProps = {
  disabled?: boolean;
  onChange: (status: ProductListItem["status"]) => void;
  status: ProductListItem["status"];
};

export function ProductStatusBadge({ disabled, onChange, status }: ProductStatusBadgeProps) {
  const style = status === "ACTIVE" ? "border-emerald-200 bg-emerald-50 text-emerald-600" : status === "DRAFT" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-gray-200 bg-gray-100 text-gray-600";

  return (
    <label className={`relative inline-flex min-w-[92px] items-center rounded-lg border ${style}`}>
      <select
        aria-label="Product status"
        className="h-9 w-full appearance-none bg-transparent px-3 pr-8 text-xs font-medium outline-none disabled:cursor-wait disabled:opacity-60"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ProductListItem["status"])}
        value={status}
      >
        <option value="ACTIVE">Live</option>
        <option value="DRAFT">Draft</option>
        <option value="ARCHIVED">Trash</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5" />
    </label>
  );
}
