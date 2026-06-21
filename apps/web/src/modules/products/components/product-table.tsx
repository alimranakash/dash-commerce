"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { bulkUpdateProductStatusAction, updateProductStatusAction } from "../product.actions";
import { ProductHoverActions } from "./product-hover-actions";
import type { ProductListItem } from "./product-list.types";
import { ProductRow, ProductThumbnail } from "./product-row";
import { ProductStatusBadge } from "./product-status-badge";

type ProductTableProps = { currency: string; products: ProductListItem[]; storeSlug: string };

export function ProductTable({ currency, products, storeSlug }: ProductTableProps) {
  const router = useRouter();
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ProductListItem["status"]>("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const allSelected = products.length > 0 && selectedIds.size === products.length;

  useEffect(() => {
    setSelectedIds((current) => new Set([...current].filter((id) => products.some((product) => product.id === id))));
  }, [products]);

  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = selectedIds.size > 0 && !allSelected;
  }, [allSelected, selectedIds.size]);

  function updateSelection(productId: string, selected: boolean) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(productId); else next.delete(productId);
      return next;
    });
  }

  function changeStatus(productId: string, status: ProductListItem["status"]) {
    setError(null);
    startTransition(async () => {
      const result = await updateProductStatusAction(productId, status);
      if (!result.ok) setError(result.error); else router.refresh();
    });
  }

  function applyBulkStatus() {
    if (selectedIds.size === 0) return;
    setError(null);
    startTransition(async () => {
      const result = await bulkUpdateProductStatusAction([...selectedIds], bulkStatus);
      if (!result.ok) setError(result.error);
      else {
        setSelectedIds(new Set());
        router.refresh();
      }
    });
  }

  if (products.length === 0) return <div className="grid min-h-60 place-items-center border-t border-[#efeff4] px-6 text-center"><div><p className="text-sm font-semibold text-[#383943]">No products found</p><p className="mt-1 text-xs text-[#8b8c96]">Create a product or adjust the current filters.</p><Link className="mt-4 inline-flex rounded-lg bg-[#7c3aed] px-4 py-2 text-xs font-semibold text-white" href="/dashboard/products/new">New Product</Link></div></div>;

  return (
    <>
      {selectedIds.size > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-[#ddd6fe] bg-[#f7f5ff] px-3 py-2">
          <span className="mr-auto text-xs font-medium text-[#5b31db]">{selectedIds.size} selected</span>
          <select aria-label="Bulk status action" className="h-9 rounded-lg border border-[#d9d3ef] bg-white px-3 text-xs outline-none" disabled={isPending} onChange={(event) => setBulkStatus(event.target.value as ProductListItem["status"])} value={bulkStatus}><option value="ACTIVE">Move to Live</option><option value="DRAFT">Move to Draft</option><option value="ARCHIVED">Move to Trash</option></select>
          <button className="h-9 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white disabled:opacity-60" disabled={isPending} onClick={applyBulkStatus} type="button">{isPending ? "Updating..." : "Apply"}</button>
        </div>
      ) : null}
      {error ? <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{error}</p> : null}
      <table className="hidden w-full min-w-[940px] border-collapse text-left md:table">
        <thead className="bg-[#f7f7f9] text-xs font-medium text-[#34353e]"><tr><th className="w-12 rounded-l-md px-4 py-3"><input ref={selectAllRef} aria-label="Select all products" checked={allSelected} className="h-4 w-4 rounded border-[#c9c9d2] accent-[#7c3aed]" onChange={(event) => setSelectedIds(event.target.checked ? new Set(products.map((product) => product.id)) : new Set())} type="checkbox" /></th><th className="px-3 py-3 font-medium">Product Name</th><th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Category</th><th className="px-3 py-3 font-medium">Price</th><th className="px-3 py-3 font-medium">Quantity</th><th className="rounded-r-md px-4 py-3 font-medium">Total Sales</th></tr></thead>
        <tbody>{products.map((product) => <ProductRow currency={currency} isPending={isPending} key={product.id} onSelect={updateSelection} onStatusChange={changeStatus} product={product} selected={selectedIds.has(product.id)} storeSlug={storeSlug} />)}</tbody>
      </table>
      <div className="grid gap-3 md:hidden">
        {products.map((product) => <article className="rounded-lg border border-[#ecebf3] bg-white p-4" key={product.id}><div className="flex gap-3"><ProductThumbnail product={product} /><div className="min-w-0 flex-1"><strong className="block truncate text-sm">{product.title}</strong><ProductHoverActions product={product} storeSlug={storeSlug} /></div><input aria-label={`Select ${product.title}`} checked={selectedIds.has(product.id)} className="h-4 w-4 accent-[#7c3aed]" onChange={(event) => updateSelection(product.id, event.target.checked)} type="checkbox" /></div><div className="mt-4 grid grid-cols-2 gap-3 border-t border-[#f0eff5] pt-3 text-xs"><div><span className="block text-[10px] text-[#92939d]">Status</span><div className="mt-1"><ProductStatusBadge disabled={isPending} onChange={(status) => changeStatus(product.id, status)} status={product.status} /></div></div><div><span className="block text-[10px] text-[#92939d]">Price</span><strong className="mt-2 block">{formatMoney(product.price, currency)}</strong></div><div><span className="block text-[10px] text-[#92939d]">Category</span><span className="mt-1 block">{product.category?.name ?? "Uncategorized"}</span></div><div><span className="block text-[10px] text-[#92939d]">Quantity</span><span className="mt-1 block">{product.stockQuantity}</span></div></div></article>)}
      </div>
    </>
  );
}

function formatMoney(value: string, currency: string) { return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value)); }
