import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { StockAdjustmentForm } from "../../../../modules/inventory/components/stock-adjustment-form";
import { adjustStockFormAction } from "../../../../modules/inventory/inventory.actions";
import { getInventoryProductsForStore } from "../../../../modules/inventory/inventory.service";
import { requireStore } from "../../../../modules/stores/queries";

export default async function StockAdjustmentPage() {
  const store = await requireStore();
  const products = await getInventoryProductsForStore(store.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Inventory</p>
            <h1>Manual Stock Adjustment</h1>
            <p className="auth-copy">Correct inventory with a tracked stock movement record.</p>
          </div>
        </div>
        <div className="panel-card">
          <StockAdjustmentForm
            action={adjustStockFormAction}
            products={products.map((product) => ({
              id: product.id,
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
