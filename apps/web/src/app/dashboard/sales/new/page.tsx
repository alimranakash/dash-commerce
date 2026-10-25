import Link from "next/link";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { getCustomerRecordsForStore } from "../../../../modules/customers/customer.repository";
import { getLoyaltyCapability } from "../../../../modules/loyalty/loyalty.service";
import { getStoreVariantOptions } from "../../../../modules/products/product-variants.service";
import { getProductsForStore } from "../../../../modules/products/product.service";
import { SaleForm } from "../../../../modules/sales/components/sale-form";
import { toSaleCustomerOption } from "../../../../modules/sales/sale-customer";
import { toSaleProductOptions } from "../../../../modules/sales/sale-products";
import { createSaleFormAction } from "../../../../modules/sales/sale.actions";
import { requireStore } from "../../../../modules/stores/queries";

export default async function NewSalePage() {
  const store = await requireStore();
  const [products, variantsByProduct, customers, loyalty] = await Promise.all([
    getProductsForStore(store.id),
    getStoreVariantOptions(store.id),
    getCustomerRecordsForStore(store.id),
    getLoyaltyCapability(store.id)
  ]);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page max-w-none">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Sales</p>
            <h1>New sale</h1>
            <p className="auth-copy">
              Create an online or offline sale record. Scan a product&apos;s barcode label to add it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link className="secondary link-button" href="/dashboard/products/barcodes">Print labels</Link>
            <Link className="secondary link-button" href="/dashboard/sales">Back</Link>
          </div>
        </div>
        <div className="panel-card">
          <SaleForm
            action={createSaleFormAction}
            cancelHref="/dashboard/sales"
            currency={store.currency}
            customers={customers.map((customer) => toSaleCustomerOption(store.id, customer))}
            loyaltyLive={loyalty.live}
            products={toSaleProductOptions(products, variantsByProduct)}
          />
        </div>
      </section>
    </DashboardShell>
  );
}
