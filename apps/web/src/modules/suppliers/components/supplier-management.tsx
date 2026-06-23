import { Building2, Edit3, Eye, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { DeleteConfirmationButton } from "../../../components/dashboard/delete-confirmation-button";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { deleteSupplierFormAction } from "../supplier.actions";
import type { SupplierStatus } from "../supplier.schema";
import { SupplierStatusBadge } from "./supplier-status-badge";

type SupplierItem = {
  companyName: string | null;
  createdAt: Date;
  email: string | null;
  id: string;
  name: string;
  phone: string;
  status: SupplierStatus;
};

type SupplierManagementProps = {
  message?: string | null;
  search?: string;
  storeSlug: string;
  suppliers: SupplierItem[];
};

export function SupplierManagement({ message, search, storeSlug, suppliers }: SupplierManagementProps) {
  return (
    <DashboardShell storeSlug={storeSlug}>
      <section className="resource-page catalog-management-page">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="m-0 text-2xl font-semibold text-[#20212a]">Suppliers</h1>
            <p className="mt-2 text-sm text-[#777985]">Manage supplier profiles and purchasing contacts.</p>
          </div>
          <Link className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#6d28d9]" href="/dashboard/suppliers/new">
            <Plus className="h-3.5 w-3.5" /> Add Supplier
          </Link>
        </div>

        {message ? <p className="success-message">{message}</p> : null}

        <section className="catalog-card">
          <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <h2>All Suppliers</h2>
            <form className="flex w-full flex-col gap-2 sm:flex-row md:w-auto" action="/dashboard/suppliers">
              <input
                className="h-10 min-w-0 rounded-lg border border-[#e5e3f1] bg-white px-3 text-sm outline-none focus:border-[#8b5cf6] focus:ring-2 focus:ring-[#7c3aed]/10 sm:w-72"
                defaultValue={search}
                name="search"
                placeholder="Search suppliers"
                type="search"
              />
              <button className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#7c3aed] px-4 text-xs font-semibold text-white" type="submit">
                <Search className="h-3.5 w-3.5" /> Search
              </button>
            </form>
          </header>
          <div className="catalog-table-wrap">
            {suppliers.length ? (
              <>
                <table className="catalog-management-table">
                  <thead>
                    <tr>
                      <th aria-label="Select"><input aria-label="Select all suppliers" type="checkbox" /></th>
                      <th>Name</th>
                      <th>Company</th>
                      <th>Phone</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {suppliers.map((supplier) => (
                      <tr key={supplier.id}>
                        <td><input aria-label={`Select ${supplier.name}`} type="checkbox" /></td>
                        <td>
                          <Link className="font-semibold text-[#24252e] hover:text-[#6d3cf5]" href={`/dashboard/suppliers/${supplier.id}`}>
                            {supplier.name}
                          </Link>
                          <span className="mt-1 block text-xs text-[#85869a]">Added {formatDate(supplier.createdAt)}</span>
                        </td>
                        <td>{supplier.companyName ?? "—"}</td>
                        <td>{supplier.phone}</td>
                        <td>{supplier.email ?? "—"}</td>
                        <td><SupplierStatusBadge status={supplier.status} /></td>
                        <td>
                          <div className="catalog-row-actions">
                            <Link aria-label={`View ${supplier.name}`} href={`/dashboard/suppliers/${supplier.id}`} title="View supplier">
                              <Eye aria-hidden="true" />
                            </Link>
                            <Link aria-label={`Edit ${supplier.name}`} href={`/dashboard/suppliers/${supplier.id}/edit`} title="Edit supplier">
                              <Edit3 aria-hidden="true" />
                            </Link>
                            <DeleteConfirmationButton action={deleteSupplierFormAction.bind(null, supplier.id)} ariaLabel={`Delete ${supplier.name}`} title="Delete supplier">
                              <Trash2 aria-hidden="true" />
                            </DeleteConfirmationButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeedf5] pt-4 text-xs text-[#777985]">
                  <span>Showing {suppliers.length} suppliers</span>
                  <span className="rounded-full border border-[#e4e1f3] bg-[#faf9ff] px-3 py-1">Page 1 of 1</span>
                </div>
              </>
            ) : (
              <div className="grid min-h-[360px] place-items-center text-center">
                <div className="max-w-sm">
                  <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#f3f0ff] text-[#7c3aed]">
                    <Building2 className="h-8 w-8" />
                  </span>
                  <h3 className="mb-0 mt-5 text-lg font-semibold text-[#20212a]">No suppliers found</h3>
                  <p className="mt-2 text-sm leading-6 text-[#777985]">Add your first supplier to keep purchasing contacts organized.</p>
                  <Link className="mt-4 inline-flex h-10 items-center rounded-lg border border-[#7c3aed] px-4 text-xs font-semibold text-[#6d3cf5]" href="/dashboard/suppliers/new">
                    Add Supplier
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </section>
    </DashboardShell>
  );
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(value);
}
