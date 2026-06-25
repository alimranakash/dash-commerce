import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { getCustomerRecordsForStore } from "../../../../modules/customers/customer.repository";
import { getProductsForStore } from "../../../../modules/products/product.service";
import { SaleForm } from "../../../../modules/sales/components/sale-form";
import { createSaleFormAction } from "../../../../modules/sales/sale.actions";
import { requireStore } from "../../../../modules/stores/queries";

export default async function NewSalePage() {
  const store = await requireStore();
  const [products, customers] = await Promise.all([
    getProductsForStore(store.id),
    getCustomerRecordsForStore(store.id)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Sales</p>
            <h1>New sale</h1>
            <p className="auth-copy">Create an online or offline sale record.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/sales">Back</Link>
        </div>
        <div className="panel-card">
          <SaleForm
            action={createSaleFormAction}
            cancelHref="/dashboard/sales"
            currency={store.currency}
            customers={customers.map((customer) => ({
              email: customer.email,
              id: customer.id,
              name: customer.name,
              phone: customer.phone
            }))}
            products={products.map((product) => ({
              id: product.id,
              price: product.price.toString(),
              sku: product.sku,
              stockQuantity: product.stockQuantity,
              title: product.title
            }))}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
