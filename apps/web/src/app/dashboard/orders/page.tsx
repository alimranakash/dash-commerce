import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { OrderListControls, type OrderFilterKey } from "../../../modules/orders/components/order-list-controls";
import { getOrdersForStore } from "../../../modules/orders/order.service";
import { requireStore } from "../../../modules/stores/queries";

type OrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersPage({ searchParams }: OrdersPageProps) {
  const store = await requireStore();
  const orders = await getOrdersForStore(store.id);
  const params = await searchParams;
  const activeFilter = parseOrderFilter(singleValue(params.status));
  const search = singleValue(params.search).trim();
  const dateRange = singleValue(params.dateRange).trim();
  const counts = getOrderCounts(orders);
  const visibleOrders = orders.filter((order) => matchesStatus(order, activeFilter) && matchesSearch(order, search));

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading"><h1>Orders</h1></div>
        <OrderListControls activeFilter={activeFilter} counts={counts} dateRange={dateRange} search={search} />
        {visibleOrders.length === 0 ? (
          <div className="empty-state">
            <h2>{orders.length ? "No matching orders" : "No orders yet"}</h2>
            <p>{orders.length ? "Try another status or search term." : "Orders from the public storefront checkout will appear here."}</p>
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
                {visibleOrders.map((order) => (
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

type OrderListRecord = Awaited<ReturnType<typeof getOrdersForStore>>[number];

function getOrderCounts(orders: OrderListRecord[]): Record<OrderFilterKey, number> {
  return {
    all: orders.length,
    pending: orders.filter((order) => order.status === "PENDING").length,
    processing: orders.filter((order) => order.status === "CONFIRMED" || order.status === "PROCESSING").length,
    completed: orders.filter((order) => order.status === "COMPLETED").length,
    cancelled: orders.filter((order) => order.status === "CANCELLED").length,
    "on-hold": 0,
    "partially-refunded": 0,
    refunded: orders.filter((order) => order.paymentStatus === "REFUNDED").length
  };
}

function matchesStatus(order: OrderListRecord, filter: OrderFilterKey) {
  if (filter === "all") return true;
  if (filter === "pending") return order.status === "PENDING";
  if (filter === "processing") return order.status === "CONFIRMED" || order.status === "PROCESSING";
  if (filter === "completed") return order.status === "COMPLETED";
  if (filter === "cancelled") return order.status === "CANCELLED";
  if (filter === "refunded") return order.paymentStatus === "REFUNDED";
  return false;
}

function matchesSearch(order: OrderListRecord, search: string) {
  if (!search) return true;
  const query = search.toLowerCase();
  return [order.orderNumber, order.customerName, order.customerEmail, order.customerPhone]
    .some((value) => value?.toLowerCase().includes(query));
}

function parseOrderFilter(value: string): OrderFilterKey {
  const filters: OrderFilterKey[] = ["pending", "processing", "completed", "cancelled", "on-hold", "partially-refunded", "refunded"];
  return filters.includes(value as OrderFilterKey) ? value as OrderFilterKey : "all";
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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
