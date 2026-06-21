import { ImageIcon } from "lucide-react";
import { ProductHoverActions } from "./product-hover-actions";
import type { ProductListItem } from "./product-list.types";
import { ProductStatusBadge } from "./product-status-badge";

type ProductRowProps = {
  currency: string;
  isPending: boolean;
  onSelect: (productId: string, selected: boolean) => void;
  onStatusChange: (productId: string, status: ProductListItem["status"]) => void;
  product: ProductListItem;
  selected: boolean;
  storeSlug: string;
};

export function ProductRow({ currency, isPending, onSelect, onStatusChange, product, selected, storeSlug }: ProductRowProps) {
  return (
    <tr className="group border-b border-[#efeff4] transition hover:bg-[#fcfbff]">
      <td className="w-12 px-4 py-5"><input aria-label={`Select ${product.title}`} checked={selected} className="h-4 w-4 rounded border-[#c9c9d2] accent-[#7c3aed]" onChange={(event) => onSelect(product.id, event.target.checked)} type="checkbox" /></td>
      <td className="min-w-[300px] px-3 py-5">
        <div className="flex items-center gap-3">
          <ProductThumbnail product={product} />
          <div className="min-w-0"><strong className="block truncate text-[13px] font-medium text-[#34353e]">{product.title}</strong><ProductHoverActions product={product} storeSlug={storeSlug} /></div>
        </div>
      </td>
      <td className="px-3 py-5"><ProductStatusBadge disabled={isPending} onChange={(status) => onStatusChange(product.id, status)} status={product.status} /></td>
      <td className="px-3 py-5 text-xs text-[#555660]">{product.category?.name ?? "Uncategorized"}</td>
      <td className="px-3 py-5 text-xs font-medium text-[#3e3f48]">{formatMoney(product.price, currency)}</td>
      <td className="px-3 py-5 text-xs text-[#555660]">{product.stockQuantity}</td>
      <td className="px-4 py-5 text-xs text-[#555660]">—</td>
    </tr>
  );
}

export function ProductThumbnail({ product }: { product: ProductListItem }) {
  return <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-[#ecebf2] bg-[#fafafa]">{product.imageUrl ? <img alt="" className="h-full w-full object-cover" src={product.imageUrl} /> : <ImageIcon className="h-4 w-4 text-[#b6b7c0]" />}</span>;
}

function formatMoney(value: string, currency: string) { return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value)); }
