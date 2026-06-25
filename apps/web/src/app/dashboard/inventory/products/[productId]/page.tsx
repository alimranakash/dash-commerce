import { notFound } from "next/navigation";
import Link from "next/link";
import { DashboardShell } from "../../../../../components/dashboard/dashboard-shell";
import { ProductStockHistory } from "../../../../../modules/inventory/components/product-stock-history";
import { getStockMovementsForProduct } from "../../../../../modules/inventory/inventory.service";
import { getProductByIdForStore } from "../../../../../modules/products/product.service";
import { requireStore } from "../../../../../modules/stores/queries";

type ProductInventoryHistoryPageProps = {
  params: Promise<{
    productId: string;
  }>;
};

export default async function ProductInventoryHistoryPage({ params }: ProductInventoryHistoryPageProps) {
  const store = await requireStore();
  const { productId } = await params;
  const [product, movements] = await Promise.all([
    getProductByIdForStore(store.id, productId),
    getStockMovementsForProduct(store.organizationId, store.id, productId, 50)
  ]);

  if (!product) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Inventory</p>
            <h1>{product.title}</h1>
            <p className="auth-copy">Current stock: {product.stockQuantity}</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/inventory">
            Back to Inventory
          </Link>
        </div>
        <ProductStockHistory movements={movements} productId={product.id} />
      </section>
    </DashboardShell>
  );
}
