import Link from "next/link";
import { PackageCheck, PackageMinus, PackageSearch, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { DashboardQueryForm } from "../../../components/dashboard/dashboard-query-form";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { StockMovementBadge, movementTypeLabel } from "../../../modules/inventory/components/stock-movement-badge";
import {
  getInventoryProductsForStore,
  getInventorySummaryForStore,
  getStockMovementsForStore
} from "../../../modules/inventory/inventory.service";
import { stockMovementTypeSchema, type StockMovementType } from "../../../modules/inventory/inventory.schema";
import { requireStore } from "../../../modules/stores/queries";

type InventoryPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const movementTypes: Array<StockMovementType | "ALL"> = [
  "ALL",
  "STOCK_IN",
  "STOCK_OUT",
  "ADJUSTMENT",
  "RETURN",
  "DAMAGE",
  "LOST"
];

const controlClass =
  "h-11 w-full rounded-lg border border-[#e4e3ee] bg-white px-3 text-sm text-[#30313d] outline-none transition placeholder:text-[#9898aa] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#7c3aed]/10";

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
  const store = await requireStore();
  const params = await searchParams;
  const search = valueOf(params.search);
  const productId = valueOf(params.productId);
  const type = movementTypeFromParam(valueOf(params.type));
  const [summary, products, movements] = await Promise.all([
    getInventorySummaryForStore(store.id),
    getInventoryProductsForStore(store.id),
    getStockMovementsForStore(store.organizationId, store.id, {
      ...(productId ? { productId } : {}),
      query: search,
      type
    })
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Inventory</p>
            <h1>Stock Movements</h1>
            <p className="auth-copy">Track every stock change from purchases, sales, and manual adjustments.</p>
          </div>
          <Link className="primary link-button" href="/dashboard/inventory/adjust">
            Manual Adjustment
          </Link>
        </div>

        {params.adjusted ? <p className="success-message">Stock adjustment saved.</p> : null}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard icon={<PackageSearch className="h-4 w-4" />} label="Total Products" value={summary.totalProducts.toString()} />
          <SummaryCard icon={<PackageCheck className="h-4 w-4" />} label="Low Stock Products" value={summary.lowStockProducts.toString()} tone="amber" />
          <SummaryCard icon={<PackageMinus className="h-4 w-4" />} label="Out of Stock Products" value={summary.outOfStockProducts.toString()} tone="red" />
          <SummaryCard icon={<WalletCards className="h-4 w-4" />} label="Total Stock Value" value={formatCurrency(summary.totalStockValue, store.currency)} tone="green" />
        </div>

        <div className="panel-card mt-5 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="m-0 text-base font-semibold text-[#20212c]">Movement History</h2>
              <p className="m-0 mt-1 text-xs text-[#74758a]">Review stock changes across your catalog.</p>
            </div>
          </div>

          <DashboardQueryForm actionPath="/dashboard/inventory" className="mb-5 grid gap-3 rounded-xl border border-[#efedf8] bg-[#fbfaff] p-3 lg:grid-cols-[minmax(240px,1fr)_230px_190px_112px]">
            <input className={controlClass} defaultValue={search} name="search" placeholder="Search product, SKU, or reason" type="search" />
            <select className={controlClass} defaultValue={productId} name="productId">
              <option value="">All products</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title}
                </option>
              ))}
            </select>
            <select className={controlClass} defaultValue={type === "ALL" ? "" : type} name="type">
              {movementTypes.map((movementType) => (
                <option key={movementType} value={movementType === "ALL" ? "" : movementType}>
                  {movementType === "ALL" ? "All types" : movementTypeLabel(movementType)}
                </option>
              ))}
            </select>
            <button className="h-11 rounded-lg bg-[#7c3aed] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#6d28d9] focus:outline-none focus:ring-4 focus:ring-[#7c3aed]/20" type="submit">
              Filter
            </button>
          </DashboardQueryForm>

          {movements.length ? (
            <div className="overflow-hidden rounded-xl border border-[#efeff5] bg-white">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] border-collapse text-left text-xs">
                  <thead className="bg-[#f7f7fa] text-[#565762]">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Date</th>
                      <th className="px-4 py-3 font-semibold">Product</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Source</th>
                      <th className="px-4 py-3 font-semibold">Qty Change</th>
                      <th className="px-4 py-3 font-semibold">Previous</th>
                      <th className="px-4 py-3 font-semibold">New</th>
                      <th className="px-4 py-3 font-semibold">Reason</th>
                      <th className="px-4 py-3 text-right font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#efeff5]">
                    {movements.map((movement) => (
                      <tr className="transition hover:bg-[#fbfaff]" key={movement.id}>
                        <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{formatDate(movement.createdAt)}</td>
                        <td className="px-4 py-4">
                          <div className="font-semibold text-[#20212c]">{movement.product.title}</div>
                          {movement.product.sku ? <div className="mt-1 text-[11px] text-[#8a8b98]">SKU: {movement.product.sku}</div> : null}
                        </td>
                        <td className="whitespace-nowrap px-4 py-4"><StockMovementBadge type={movement.type as StockMovementType} /></td>
                        <td className="whitespace-nowrap px-4 py-4 text-[#565762]">{sourceLabel(movement.sourceType, movement.sourceId)}</td>
                        <td className={`whitespace-nowrap px-4 py-4 font-semibold ${movement.quantityChange >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                          {movement.quantityChange >= 0 ? "+" : ""}
                          {movement.quantityChange}
                        </td>
                        <td className="px-4 py-4 text-[#30313d]">{movement.previousQuantity}</td>
                        <td className="px-4 py-4 text-[#30313d]">{movement.newQuantity}</td>
                        <td className="max-w-[220px] px-4 py-4 text-[#565762]">{movement.reason}</td>
                        <td className="px-4 py-4 text-right">
                          <Link className="inline-flex h-8 items-center rounded-lg border border-[#ddd6fe] px-3 text-xs font-semibold text-[#6d3cf5] transition hover:bg-[#f3f0ff]" href={`/dashboard/inventory/products/${movement.productId}`}>
                            History
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-[#dedcf0] bg-[#fbfaff] px-5 py-12 text-center">
              <h2 className="m-0 text-base font-semibold">No stock movements found</h2>
              <p className="m-0 mt-2 text-sm text-[#74758a]">Inventory history will appear after purchases, sales, or adjustments update stock.</p>
            </div>
          )}
        </div>
      </section>
    </DashboardShell>
  );
}

function SummaryCard({
  icon,
  label,
  tone = "purple",
  value
}: {
  icon: ReactNode;
  label: string;
  tone?: "amber" | "green" | "purple" | "red";
  value: string;
}) {
  const toneClass = {
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-violet-50 text-violet-700",
    red: "bg-red-50 text-red-700"
  }[tone];

  return (
    <div className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="m-0 text-xs font-medium text-[#74758a]">{label}</p>
          <strong className="mt-2 block text-2xl font-semibold tracking-tight text-[#20212c]">{value}</strong>
        </div>
        <div className={`inline-flex shrink-0 rounded-xl p-2 ${toneClass}`}>{icon}</div>
      </div>
    </div>
  );
}

function valueOf(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

function movementTypeFromParam(value: string): StockMovementType | "ALL" {
  const parsed = stockMovementTypeSchema.safeParse(value.toUpperCase());
  return parsed.success ? parsed.data : "ALL";
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    maximumFractionDigits: 2,
    style: "currency"
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function sourceLabel(sourceType: string, sourceId: string | null) {
  const label = sourceType.toLowerCase().replace(/\b\w/g, (character) => character.toUpperCase());
  return sourceId ? `${label} #${sourceId.slice(-6).toUpperCase()}` : label;
}
