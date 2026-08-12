import { DashboardShell } from "../../../components/dashboard/dashboard-shell";
import { CourierBalance } from "../../../modules/courier/components/courier-balance";
import {
  CourierFilterTabs,
  matchesCourierFilter,
  parseCourierFilter,
  type CourierFilterKey
} from "../../../modules/courier/components/courier-filter-tabs";
import { OrdersCourierTable, type OrderCourierRow } from "../../../modules/courier/components/orders-courier-table";
import { describeSendTarget } from "../../../modules/courier/courier-accounts.service";
import { getCachedCourierBalance } from "../../../modules/courier/courier-insight.service";
import { getShipmentsByOrderId } from "../../../modules/courier/courier.service";
import { getCourierProvider } from "../../../modules/courier/providers/registry";
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
  const statusFiltered = scopedOrders.filter((order) => matchesStatus(order, activeFilter));
  const courierFilter = parseCourierFilter(singleValue(params.courier));
  // Cache-only: this page must never wait on a carrier API.
  const sendTarget = await describeSendTarget(store.id);
  const courierBalance = sendTarget.provider
    ? await getCachedCourierBalance(store.id, sendTarget.provider)
    : null;

  // One query badges every row.
  const shipments = await getShipmentsByOrderId(store.id, statusFiltered.map((order) => order.id));
  const rows: OrderCourierRow[] = statusFiltered.map((order) => {
    const shipment = shipments.get(order.id) ?? null;

    return {
      // Mirrors the server-side derivation so the confirm sheet's total matches
      // what will actually be collected.
      codAmount: order.paymentStatus === "PAID" ? 0 : Number(order.totalAmount),
      courierLabel: shipment ? getCourierProvider(shipment.provider)?.label ?? shipment.provider : null,
      createdAt: formatDate(order.createdAt),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      id: order.id,
      itemCount: order.items.length,
      lastSyncedLabel: shipment?.lastSyncedAt ? `checked ${formatRelative(shipment.lastSyncedAt)}` : null,
      orderNumber: order.orderNumber,
      paymentStatus: order.paymentStatus,
      providerStatus: shipment?.providerStatus ?? null,
      shipmentId: shipment?.id ?? null,
      shipmentStatus: shipment?.status ?? null,
      status: order.status,
      total: formatMoney(order.totalAmount, order.currency),
      trackingCode: shipment?.trackingCode ?? null
    };
  });

  const visibleRows = rows.filter((row) => matchesCourierFilter(courierFilter, row.shipmentStatus));
  const courierCounts = countCourierStates(rows);
  const carriedParams = {
    ...(activeFilter !== "all" ? { status: activeFilter } : {}),
    ...(search ? { search } : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo ? { dateTo } : {})
  };

  return (
    <DashboardShell storeSlug={store.slug}>
      <section className="resource-page">
        <div className="catalog-page-heading">
          <h1>Orders</h1>
          {courierBalance ? <CourierBalance balance={courierBalance} showRefresh={false} /> : null}
        </div>
        <OrderListControls activeFilter={activeFilter} counts={counts} dateFrom={dateFrom} dateTo={dateTo} search={search} />
        <section className="rounded-xl border border-[#ececf5] bg-white px-5 pt-5 shadow-[0_8px_24px_rgba(62,54,114,0.04)]">
          <CourierFilterTabs activeFilter={courierFilter} counts={courierCounts} params={carriedParams} />
        </section>
        {visibleRows.length === 0 ? (
          <div className="empty-state">
            <h2>{orders.length ? "No matching orders" : "No orders yet"}</h2>
            <p>{orders.length ? "Try another status, courier state, or search term." : "Orders from the public storefront checkout will appear here."}</p>
          </div>
        ) : (
          <OrdersCourierTable
            courierLabel={sendTarget.label}
            rows={visibleRows}
            sendDisabledReason={sendTarget.reason}
          />
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

function countCourierStates(rows: OrderCourierRow[]): Record<CourierFilterKey, number> {
  const keys: CourierFilterKey[] = [
    "all",
    "not-sent",
    "sent",
    "in-transit",
    "delivered",
    "returned",
    "failed"
  ];

  return keys.reduce(
    (counts, key) => {
      counts[key] = rows.filter((row) => matchesCourierFilter(key, row.shipmentStatus)).length;

      return counts;
    },
    {} as Record<CourierFilterKey, number>
  );
}

function formatRelative(value: Date) {
  const minutes = Math.round((Date.now() - value.getTime()) / 60000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`;

  return `${Math.round(minutes / 1440)}d ago`;
}
