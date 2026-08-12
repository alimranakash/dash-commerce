import Link from "next/link";
import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { CourierBalance } from "../../../modules/courier/components/courier-balance";
import { describeSendTarget } from "../../../modules/courier/courier-accounts.service";
import { getCachedCourierBalance } from "../../../modules/courier/courier-insight.service";
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
  const dateFrom = singleValue(params.dateFrom).trim();
  const dateTo = singleValue(params.dateTo).trim();
  const scopedOrders = orders.filter((order) => matchesSearch(order, search) && matchesDateRange(order, dateFrom, dateTo));
  const counts = getOrderCounts(scopedOrders);
  const visibleOrders = scopedOrders.filter((order) => matchesStatus(order, activeFilter));
  // Cache-only: this page must never wait on a carrier API.
  const sendTarget = await describeSendTarget(store.id);
  const courierBalance = sendTarget.provider
    ? await getCachedCourierBalance(store.id, sendTarget.provider)
    : null;

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading">
          <h1>Orders</h1>
          {courierBalance ? <CourierBalance balance={courierBalance} showRefresh={false} /> : null}
        </div>
        <OrderListControls activeFilter={activeFilter} counts={counts} dateFrom={dateFrom} dateTo={dateTo} search={search} />
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
    refunded: orders.filter((order) => order.paymentStatus === "REFUNDED").length
  };
}

function matchesDateRange(order: OrderListRecord, dateFrom: string, dateTo: string) {
  const created = order.createdAt.getTime();
  const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null;
  const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;

  if (from && !Number.isNaN(from.getTime()) && created < from.getTime()) return false;
  if (to && !Number.isNaN(to.getTime()) && created > to.getTime()) return false;

  return true;
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
  const filters: OrderFilterKey[] = ["pending", "processing", "completed", "cancelled", "refunded"];
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
