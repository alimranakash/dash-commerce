import Link from "next/link";
import type { DashboardLowStockProduct } from "../analytics.types";

type LowStockProductsProps = {
  products: DashboardLowStockProduct[];
};

export function LowStockProducts({ products }: LowStockProductsProps) {
  return (
    <section className="panel-card dashboard-panel">
      <div className="panel-heading">
        <h2>Low stock</h2>
        <Link href="/dashboard/products">Manage</Link>
      </div>
      {products.length === 0 ? (
        <div className="empty-state inline-empty">
          <h2>Stock looks healthy</h2>
          <p>Products at or below their low-stock threshold will show here.</p>
        </div>
      ) : (
        <div className="analytics-list">
          {products.map((product) => (
            <div className="analytics-list-row" key={product.id}>
              <div>
                <strong>{product.title}</strong>
                <span>Threshold {product.lowStockThreshold}</span>
              </div>
              <strong>{product.stockQuantity} left</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
