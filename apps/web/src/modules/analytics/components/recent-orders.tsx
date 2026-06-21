import Link from "next/link";
import type { DashboardRecentOrder } from "../analytics.types";

type RecentOrdersProps = {
  currency: string;
  orders: DashboardRecentOrder[];
};

export function RecentOrders({ currency, orders }: RecentOrdersProps) {
  if (orders.length === 0) {
    return (
      <section className="panel-card dashboard-panel">
        <PanelHeading title="Recent orders" />
        <div className="empty-state inline-empty">
          <h2>No orders yet</h2>
          <p>Orders from storefront checkout will appear here as soon as customers buy.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="panel-card dashboard-panel">
      <PanelHeading actionHref="/dashboard/orders" actionLabel="View all" title="Recent orders" />
      <div className="table-card compact-table-card">
        <table className="resource-table analytics-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Total</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td data-label="Order">
                  <Link href={`/dashboard/orders/${order.id}`}>
                    <strong>{order.orderNumber}</strong>
                  </Link>
                </td>
                <td data-label="Customer">{order.customerName}</td>
                <td data-label="Total">{formatMoney(order.totalAmount, order.currency || currency)}</td>
                <td data-label="Status">
                  <span className="status-pill">{order.status.toLowerCase()}</span>
                </td>
                <td data-label="Created">{formatDate(order.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PanelHeading({
  actionHref,
  actionLabel,
  title
}: {
  actionHref?: string;
  actionLabel?: string;
  title: string;
}) {
  return (
    <div className="panel-heading">
      <h2>{title}</h2>
      {actionHref && actionLabel ? <Link href={actionHref}>{actionLabel}</Link> : null}
    </div>
  );
}

function formatMoney(value: string, currency: string) {
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
