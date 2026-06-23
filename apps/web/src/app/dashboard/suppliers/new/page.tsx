import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { createSupplierFormAction } from "../../../../modules/suppliers/supplier.actions";
import { SupplierForm } from "../../../../modules/suppliers/components/supplier-form";
import { requireStore } from "../../../../modules/stores/queries";

export default async function NewSupplierPage() {
  const store = await requireStore();

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Suppliers</p>
            <h1>Add supplier</h1>
            <p className="auth-copy">Create a supplier profile for future purchasing workflows.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/suppliers">
            Back
          </Link>
        </div>
        <div className="panel-card">
          <SupplierForm action={createSupplierFormAction} cancelHref="/dashboard/suppliers" submitLabel="Create Supplier" />
        </div>
      </section>
    </DashboardShell>
  );
}
