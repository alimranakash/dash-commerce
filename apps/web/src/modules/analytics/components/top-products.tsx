import type { DashboardTopProduct } from "../analytics.types";

type TopProductsProps = {
  currency: string;
  products: DashboardTopProduct[];
};

export function TopProducts({ currency, products }: TopProductsProps) {
  return (
    <section className="panel-card dashboard-panel">
      <div className="panel-heading">
        <h2>Top products</h2>
      </div>
      {products.length === 0 ? (
        <div className="empty-state inline-empty">
          <h2>No sales data yet</h2>
          <p>Best-selling products will appear after orders are placed.</p>
        </div>
      ) : (
        <div className="analytics-list">
          {products.map((product) => (
            <div className="analytics-list-row" key={product.productId}>
              <div>
                <strong>{product.title}</strong>
                <span>{product.quantitySold} sold</span>
              </div>
              <strong>{formatMoney(product.revenue, currency)}</strong>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}
