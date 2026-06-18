import Link from "next/link";
import { notFound } from "next/navigation";
import { DashboardShell } from "../../../../components/dashboard/dashboard-shell";
import { getOrderByIdForStore } from "../../../../modules/orders/order.service";
import { requireStore } from "../../../../modules/stores/queries";

type OrderDetailsPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function OrderDetailsPage({ params }: OrderDetailsPageProps) {
  const { orderId } = await params;
  const store = await requireStore();
  const order = await getOrderByIdForStore(store.id, orderId);

  if (!order) {
    notFound();
  }

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="resource-header">
          <div>
            <p className="eyebrow">Order details</p>
            <h1>{order.orderNumber}</h1>
            <p className="auth-copy">Placed {formatDate(order.createdAt)}.</p>
          </div>
          <Link className="secondary link-button" href="/dashboard/orders">
            Back to orders
          </Link>
        </div>
        <div className="overview-grid">
          <div className="overview-card">
            <span>Order status</span>
            <strong>{order.status.toLowerCase()}</strong>
          </div>
          <div className="overview-card">
            <span>Payment status</span>
            <strong>{order.paymentStatus.toLowerCase()}</strong>
          </div>
          <div className="overview-card">
            <span>Fulfillment</span>
            <strong>{order.fulfillmentStatus.toLowerCase()}</strong>
          </div>
        </div>
        <div className="split-layout">
          <section className="dashboard-shell order-detail-panel">
            <p className="eyebrow">Customer</p>
            <h2>{order.customerName}</h2>
            <p>{order.customerPhone}</p>
            {order.customerEmail ? <p>{order.customerEmail}</p> : null}
            {order.shippingAddress ? (
              <address>
                <strong>Shipping address</strong>
                <span>{order.shippingAddress.addressLine1}</span>
                {order.shippingAddress.addressLine2 ? (
                  <span>{order.shippingAddress.addressLine2}</span>
                ) : null}
                <span>
                  {[order.shippingAddress.area, order.shippingAddress.city, order.shippingAddress.district]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                <span>{order.shippingAddress.country}</span>
              </address>
            ) : null}
            {order.notes ? (
              <div>
                <strong>Notes</strong>
                <p>{order.notes}</p>
              </div>
            ) : null}
          </section>
          <section className="dashboard-shell order-detail-panel">
            <p className="eyebrow">Totals</p>
            <dl className="order-totals">
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.subtotalAmount, order.currency)}</dd>
              <dt>Shipping</dt>
              <dd>{formatMoney(order.shippingAmount, order.currency)}</dd>
              <dt>Discount</dt>
              <dd>{formatMoney(order.discountAmount, order.currency)}</dd>
              <dt>Tax</dt>
              <dd>{formatMoney(order.taxAmount, order.currency)}</dd>
              <dt>Total</dt>
              <dd>{formatMoney(order.totalAmount, order.currency)}</dd>
            </dl>
          </section>
        </div>
        <section className="dashboard-shell order-detail-panel">
          <p className="eyebrow">Payment</p>
          <dl className="order-totals">
            <dt>Method</dt>
            <dd>{order.paymentMethodName}</dd>
            <dt>Type</dt>
            <dd>{order.paymentMethodType.toLowerCase()}</dd>
            <dt>Status</dt>
            <dd>{order.paymentStatus.toLowerCase()}</dd>
            {order.paymentReference ? (
              <>
                <dt>Reference</dt>
                <dd>{order.paymentReference}</dd>
              </>
            ) : null}
            {order.paymentNote ? (
              <>
                <dt>Customer note</dt>
                <dd>{order.paymentNote}</dd>
              </>
            ) : null}
          </dl>
        </section>
        <div className="table-card">
          <table className="resource-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>SKU</th>
                <th>Price</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Item">
                    <strong>{item.title}</strong>
                  </td>
                  <td data-label="SKU">{item.sku ?? "None"}</td>
                  <td data-label="Price">{formatMoney(item.price, order.currency)}</td>
                  <td data-label="Qty">{item.quantity}</td>
                  <td data-label="Total">{formatMoney(item.total, order.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
