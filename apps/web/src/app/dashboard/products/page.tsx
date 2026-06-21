import { Plus } from "lucide-react";
import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { ProductFilters } from "../../../modules/products/components/product-filters";
import type { ProductListItem, ProductListStatus } from "../../../modules/products/components/product-list.types";
import { ProductTable } from "../../../modules/products/components/product-table";
import { ProductTabs } from "../../../modules/products/components/product-tabs";
import { getProductsForStore } from "../../../modules/products/product.service";
import { requireStore } from "../../../modules/stores/queries";

type ProductsPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const store = await requireStore();
  const products = await getProductsForStore(store.id);
  const params = await searchParams;
  const activeStatus = statusFromParam(valueOf(params.status));
  const search = valueOf(params.search);
  const category = valueOf(params.category);
  const sort = valueOf(params.sort) || "newest";
  const counts = {
    all: products.length,
    draft: products.filter((product) => product.status === "DRAFT").length,
    live: products.filter((product) => product.status === "ACTIVE").length,
    trash: products.filter((product) => product.status === "ARCHIVED").length
  };
  const categories = Array.from(
    new Map(products.flatMap((product) => (product.category ? [[product.category.id, product.category]] : []))).values()
  ).sort((left, right) => left.name.localeCompare(right.name));
  const filteredProducts = sortProducts(
    products.filter((product) => {
      if (activeStatus === "live" && product.status !== "ACTIVE") return false;
      if (activeStatus === "draft" && product.status !== "DRAFT") return false;
      if (activeStatus === "trash" && product.status !== "ARCHIVED") return false;
      if (category && product.categoryId !== category) return false;
      if (search && !`${product.title} ${product.sku ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    sort
  );
  const listItems: ProductListItem[] = filteredProducts.map((product) => ({
    category: product.category ? { id: product.category.id, name: product.category.name } : null,
    id: product.id,
    imageUrl: product.images[0]?.url ?? null,
    price: product.price.toString(),
    slug: product.slug,
    status: product.status,
    stockQuantity: product.stockQuantity,
    title: product.title
  }));
  const message = getProductsMessage(params);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="mx-auto grid max-w-[1480px] gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3"><h1 className="text-2xl font-semibold text-[#20212a]">Products</h1><Link className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6d28d9]" href="/dashboard/products/new"><Plus className="h-3.5 w-3.5" />New Product</Link></div>
          <button aria-disabled="true" className="text-xs font-semibold text-[#6d3cf5] underline underline-offset-4" title="Product import is not available yet" type="button">Import Products</button>
        </div>

        {message ? <p className="success-message">{message}</p> : null}

        <div className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <ProductTabs active={activeStatus} counts={counts} />
            <ProductFilters activeStatus={activeStatus} categories={categories} category={category} search={search} sort={sort} />
          </div>
          <ProductTable currency={store.currency} products={listItems} storeSlug={store.slug} />
        </div>
      </section>
    </DashboardShell>
  );
}

function valueOf(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }
function statusFromParam(value: string): ProductListStatus { return value === "live" || value === "draft" || value === "trash" ? value : "all"; }
function sortProducts<T extends { price: unknown; stockQuantity: number; title: string }>(products: T[], sort: string) {
  const sorted = [...products];
  if (sort === "title") return sorted.sort((a, b) => a.title.localeCompare(b.title));
  if (sort === "price-asc") return sorted.sort((a, b) => Number(a.price) - Number(b.price));
  if (sort === "price-desc") return sorted.sort((a, b) => Number(b.price) - Number(a.price));
  if (sort === "stock") return sorted.sort((a, b) => b.stockQuantity - a.stockQuantity);
  return sorted;
}
function getProductsMessage(searchParams: Record<string, string | string[] | undefined>) { if (searchParams.created) return "Product created."; if (searchParams.updated) return "Product updated."; if (searchParams.archived) return "Product moved to trash."; return null; }
