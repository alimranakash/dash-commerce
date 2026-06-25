import { Edit3, Eye, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { cancelPurchaseAction } from "../purchase.actions";
import type { PurchaseStatus } from "../purchase.schema";
import { PurchaseStatusBadge } from "./purchase-status-badge";
import { PurchaseTabs } from "./purchase-tabs";

type PurchaseListItem = {
  _count: {
    items: number;
  };
  dueAmount: { toString(): string };
  id: string;
  paidAmount: { toString(): string };
  purchaseDate: Date;
  purchaseNumber: string;
  status: PurchaseStatus;
  supplier: {
    companyName: string | null;
    name: string;
  };
  totalAmount: { toString(): string };
};

type PurchaseListProps = {
  activeStatus: PurchaseStatus | "ALL";
  counts: Record<"all" | "cancelled" | "draft" | "ordered" | "received", number>;
  currency: string;
  message?: string | null;
  purchases: PurchaseListItem[];
  search?: string;
  storeSlug: string;
};

export function PurchaseList({ activeStatus, counts, currency, message, purchases, search, storeSlug }: PurchaseListProps) {
  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="mx-auto grid max-w-[1480px] gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold text-[#20212a]">Purchases</h1>
            <p className="mt-2 text-sm text-[#777985]">Track supplier purchases and incoming inventory.</p>
          </div>
          <Link className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6d28d9]" href="/dashboard/purchases/new">
            <Plus className="h-3.5 w-3.5" /> Add Purchase
          </Link>
        </div>

        {message ? <p className="success-message">{message}</p> : null}

        <section className="rounded-xl border border-[#ececf5] bg-white p-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <PurchaseTabs active={activeStatus} counts={counts} search={search} />
            <form className="flex flex-col gap-2 sm:flex-row" action="/dashboard/purchases">
              {activeStatus !== "ALL" ? <input name="status" type="hidden" value={activeStatus.toLowerCase()} /> : null}
              <input
                className="h-10 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 sm:w-72"
                defaultValue={search}
                name="search"
                placeholder="Search purchases or suppliers"
                type="search"
              />
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white" type="submit">
                <Search className="h-3.5 w-3.5" /> Search
              </button>
            </form>
          </div>

          {purchases.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left text-xs">
                <thead className="bg-[#f7f7f9] text-[#34353e]">
                  <tr>
                    <th className="rounded-l-md px-4 py-3 font-medium">Purchase No</th>
                    <th className="px-3 py-3 font-medium">Supplier</th>
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Items</th>
                    <th className="px-3 py-3 font-medium">Total</th>
                    <th className="px-3 py-3 font-medium">Paid</th>
                    <th className="px-3 py-3 font-medium">Due</th>
                    <th className="px-3 py-3 font-medium">Status</th>
                    <th className="rounded-r-md px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.map((purchase) => (
                    <tr className="border-b border-[#efeff4] transition hover:bg-[#fcfbff]" key={purchase.id}>
                      <td className="px-4 py-5 font-semibold text-[#34353e]">{purchase.purchaseNumber}</td>
                      <td className="px-3 py-5">
                        <strong className="block text-[#34353e]">{purchase.supplier.name}</strong>
                        <span className="mt-1 block text-[#85869a]">{purchase.supplier.companyName ?? "No company"}</span>
                      </td>
                      <td className="px-3 py-5 text-[#555660]">{formatDate(purchase.purchaseDate)}</td>
                      <td className="px-3 py-5 text-[#555660]">{purchase._count.items}</td>
                      <td className="px-3 py-5 font-semibold">{formatMoney(purchase.totalAmount.toString(), currency)}</td>
                      <td className="px-3 py-5">{formatMoney(purchase.paidAmount.toString(), currency)}</td>
                      <td className="px-3 py-5">{formatMoney(purchase.dueAmount.toString(), currency)}</td>
                      <td className="px-3 py-5"><PurchaseStatusBadge status={purchase.status} /></td>
                      <td className="px-4 py-5">
                        <div className="catalog-row-actions">
                          <Link aria-label={`View ${purchase.purchaseNumber}`} href={`/dashboard/purchases/${purchase.id}`} title="View purchase">
                            <Eye aria-hidden="true" />
                          </Link>
                          <Link aria-label={`Edit ${purchase.purchaseNumber}`} href={`/dashboard/purchases/${purchase.id}/edit`} title="Edit purchase">
                            <Edit3 aria-hidden="true" />
                          </Link>
                          <DeleteConfirmationButton action={cancelPurchaseAction.bind(null, purchase.id)} ariaLabel={`Cancel ${purchase.purchaseNumber}`} title="Cancel purchase">
                            <Trash2 aria-hidden="true" />
                          </DeleteConfirmationButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeedf5] pt-4 text-xs text-[#777985]">
                <span>Showing {purchases.length} purchases</span>
                <span className="rounded-full border border-[#e4e1f3] bg-[#faf9ff] px-3 py-1">Page 1 of 1</span>
              </div>
            </div>
          ) : (
            <div className="grid min-h-[360px] place-items-center text-center">
              <div>
                <h2 className="text-lg font-semibold text-[#20212a]">No purchases found</h2>
                <p className="mt-2 text-sm text-[#777985]">Create a purchase to track supplier inventory receipts.</p>
                <Link className="mt-4 inline-flex h-10 items-center rounded-lg border border-[#7c3aed] px-4 text-xs font-semibold text-[#6d3cf5]" href="/dashboard/purchases/new">
                  Add Purchase
                </Link>
              </div>
            </div>
          )}
        </section>
      </section>
    </DashboardShell>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", { currency, style: "currency" }).format(Number(value));
}
