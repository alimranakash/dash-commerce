import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { SupplierForm } from "../../../../../modules/suppliers/components/supplier-form";
import { updateSupplierFormAction } from "../../../../../modules/suppliers/supplier.actions";
import { getSupplierByIdForOrganization } from "../../../../../modules/suppliers/supplier.service";
import { requireStore } from "../../../../../modules/stores/queries";

type EditSupplierPageProps = {
  params: Promise<{
    supplierId: string;
  }>;
};

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  const store = await requireStore();
  const { supplierId } = await params;
  const supplier = await getSupplierByIdForOrganization(store.organizationId, supplierId);

  if (!supplier) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Suppliers</p>
            <h1>Edit supplier</h1>
            <p className="auth-copy">Update contact details, status, and internal notes.</p>
          </div>
          <Link className="secondary link-button" href={`/dashboard/suppliers/${supplier.id}`}>
            Back
          </Link>
        </div>
        <div className="panel-card">
          <SupplierForm
            action={updateSupplierFormAction.bind(null, supplier.id)}
            cancelHref={`/dashboard/suppliers/${supplier.id}`}
            supplier={supplier}
            submitLabel="Save Supplier"
          />
        </div>
      </section>
    </DashboardShell>
  );
}
