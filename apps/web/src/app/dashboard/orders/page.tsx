import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { getOrdersForStore } from "../../../modules/orders/order.service";
import { requireStore } from "../../../modules/stores/queries";

export default async function OrdersPage() {
  const store = await requireStore();
  const orders = await getOrdersForStore(store.id);

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Sales</p>
            <h1>Orders</h1>
            <p className="auth-copy">Review cash on delivery orders for {store.name}.</p>
          </div>
        </div>
        {orders.length === 0 ? (
          <div className="empty-state">
            <h2>No orders yet</h2>
            <p>Orders from the public storefront checkout will appear here.</p>
          </div>
        ) : (
          <div className="table-card">
            <table className="resource-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Total</th>
                  <th>Order status</th>
                  <th>Payment</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td data-label="Order">
                      <strong>{order.orderNumber}</strong>
                      <span>{order.items.length} item(s)</span>
                    </td>
                    <td data-label="Customer">{order.customerName}</td>
                    <td data-label="Phone">{order.customerPhone}</td>
                    <td data-label="Total">{formatMoney(order.totalAmount, order.currency)}</td>
                    <td data-label="Order status">
                      <span className="status-pill">{order.status.toLowerCase()}</span>
                    </td>
                    <td data-label="Payment">
                      <span className="status-pill">{order.paymentStatus.toLowerCase()}</span>
                    </td>
                    <td data-label="Created">{formatDate(order.createdAt)}</td>
                    <td data-label="Actions">
                      <div className="table-actions">
                        <Link href={`/dashboard/orders/${order.id}`}>View</Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardShell>
  );
}

function formatMoney(value: unknown, currency: string) {
  return new Intl.NumberFormat("en", {
    currency,
    style: "currency"
  }).format(Number(value));
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(value);
}
