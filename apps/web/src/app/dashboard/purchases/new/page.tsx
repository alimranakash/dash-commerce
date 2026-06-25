import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { getProductsForStore } from "../../../../modules/products/product.service";
import { createPurchaseFormAction } from "../../../../modules/purchases/purchase.actions";
import { PurchaseForm } from "../../../../modules/purchases/components/purchase-form";
import { getSuppliersForOrganization } from "../../../../modules/suppliers/supplier.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function NewPurchasePage() {
  const store = await requireStore();
  const [suppliers, products] = await Promise.all([
    getSuppliersForOrganization(store.organizationId),
    getProductsForStore(store.id)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Purchases</p>
            <h1>Add purchase</h1>
            <p className="auth-copy">Record incoming inventory from a supplier.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/purchases">
            Back
          </Link>
        </div>
        <div className="panel-card">
          <PurchaseForm
            action={createPurchaseFormAction}
            cancelHref="/dashboard/purchases"
            currency={store.currency}
            products={products.map((product) => ({
              costPrice: product.costPrice?.toString() ?? null,
              id: product.id,
              sku: product.sku,
              title: product.title
            }))}
            suppliers={suppliers.filter((supplier) => supplier.status === "ACTIVE").map((supplier) => ({
              id: supplier.id,
              label: supplier.companyName ? `${supplier.name} - ${supplier.companyName}` : supplier.name
            }))}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
