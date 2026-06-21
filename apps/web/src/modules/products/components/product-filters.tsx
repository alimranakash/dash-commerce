import { Search } from "lucide-react";
import type { ProductListStatus } from "./product-list.types";

type ProductFiltersProps = {
  activeStatus: ProductListStatus;
  categories: Array<{ id: string; name: string }>;
  category?: string;
  search?: string;
  sort?: string;
};

export function ProductFilters({ activeStatus, categories, category, search, sort }: ProductFiltersProps) {
  return (
    <form className="flex flex-wrap items-center justify-end gap-2" method="get">
      {activeStatus !== "all" ? <input name="status" type="hidden" value={activeStatus} /> : null}
      <input className="h-10 min-w-[190px] flex-1 rounded-lg border border-[#e6e5ef] bg-white px-3 text-xs outline-none transition placeholder:text-[#a2a3ac] focus:border-[#8b5cf6] sm:max-w-[250px]" defaultValue={search} name="search" placeholder="Search" type="search" />
      <select className="h-10 rounded-lg border border-[#e6e5ef] bg-white px-3 text-xs text-[#4e4f58] outline-none focus:border-[#8b5cf6]" defaultValue={category ?? ""} name="category">
        <option value="">Category</option>
        {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <select className="h-10 rounded-lg border border-[#e6e5ef] bg-white px-3 text-xs text-[#4e4f58] outline-none focus:border-[#8b5cf6]" defaultValue={sort ?? "newest"} name="sort">
        <option value="newest">Sort by</option>
        <option value="title">Product name</option>
        <option value="price-asc">Price: low to high</option>
        <option value="price-desc">Price: high to low</option>
        <option value="stock">Quantity</option>
      </select>
      <button aria-label="Search products" className="grid h-10 w-10 place-items-center rounded-lg bg-[#7c3aed] text-white shadow-sm transition hover:bg-[#6d28d9]" type="submit"><Search className="h-4 w-4" /></button>
    </form>
  );
}
