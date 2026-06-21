import { getReportOverviewRecords } from "./report.repository";
import type { ReportOverviewData, ReportTopCustomer, ReportTopProduct } from "./report.types";

const PERIOD_DAYS = 30;

export async function getReportOverview(storeId: string, fallbackCurrency: string): Promise<ReportOverviewData> {
  const currentStart = startOfDay(daysAgo(PERIOD_DAYS - 1));
  const previousStart = startOfDay(daysAgo(PERIOD_DAYS * 2 - 1));
  const [orders, products, customers] = await getReportOverviewRecords(storeId, previousStart);
  const currentOrders = orders.filter((order) => order.createdAt >= currentStart);
  const previousOrders = orders.filter((order) => order.createdAt < currentStart);
  const currentCustomers = customers.filter((customer) => customer.createdAt >= currentStart).length;
  const previousCustomers = customers.filter((customer) => customer.createdAt >= previousStart && customer.createdAt < currentStart).length;
  const current = summarizeOrders(currentOrders);
  const previous = summarizeOrders(previousOrders);
  const currency = currentOrders[0]?.currency ?? orders[0]?.currency ?? fallbackCurrency;

  return {
    currency,
    customers: metric(currentCustomers, previousCustomers),
    customerOverview: customerOverview(currentOrders),
    daily: dailySeries(currentOrders, currentStart),
    netRevenue: metric(current.netRevenue, previous.netRevenue),
    orders: metric(current.orderCount, previous.orderCount),
    orderStatuses: orderStatuses(currentOrders),
    productsSold: metric(current.productsSold, previous.productsSold),
    productStats: {
      averagePrice: Number(products._avg.price ?? 0),
      inventoryCount: products._sum.stockQuantity ?? 0,
      productsInCatalog: products._count._all,
      variations: 0
    },
    refunds: metric(current.refunds, previous.refunds),
    sales: metric(current.sales, previous.sales),
    topProducts: topProducts(currentOrders)
  };
}

type ReportOrder = Awaited<ReturnType<typeof getReportOverviewRecords>>[0][number];

function summarizeOrders(orders: ReportOrder[]) {
  const validOrders = orders.filter((order) => order.status !== "CANCELLED");
  const sales = sum(validOrders.map((order) => Number(order.totalAmount)));
  const refunds = sum(validOrders.filter((order) => order.paymentStatus === "REFUNDED").map((order) => Number(order.totalAmount)));

  return {
    netRevenue: Math.max(0, sales - refunds),
    orderCount: orders.length,
    productsSold: sum(validOrders.flatMap((order) => order.items.map((item) => item.quantity))),
    refunds,
    sales
  };
}

function dailySeries(orders: ReportOrder[], start: Date) {
  const points = Array.from({ length: PERIOD_DAYS }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return {
      date: dateKey(date),
      label: new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date),
      netRevenue: 0,
      orderCount: 0,
      refundCount: 0,
      refunds: 0,
      sales: 0
    };
  });
  const byDate = new Map(points.map((point) => [point.date, point]));

  for (const order of orders) {
    const point = byDate.get(dateKey(order.createdAt));
    if (!point) continue;
    point.orderCount += 1;
    if (order.status === "CANCELLED") continue;
    const amount = Number(order.totalAmount);
    point.sales += amount;
    if (order.paymentStatus === "REFUNDED") {
      point.refunds += amount;
      point.refundCount += 1;
    }
    point.netRevenue = Math.max(0, point.sales - point.refunds);
  }

  return points;
}

function orderStatuses(orders: ReportOrder[]) {
  const labels = ["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"];
  return labels.map((status) => ({
    count: orders.filter((order) => order.status === status).length,
    label: titleCase(status)
  }));
}

function topProducts(orders: ReportOrder[]): ReportTopProduct[] {
  const products = new Map<string, ReportTopProduct>();

  for (const order of orders.filter((entry) => entry.status !== "CANCELLED")) {
    for (const item of order.items) {
      const key = item.productId ?? item.title;
      const existing = products.get(key) ?? { quantity: 0, revenue: 0, title: item.title };
      existing.quantity += item.quantity;
      existing.revenue += Number(item.total);
      products.set(key, existing);
    }
  }

  return [...products.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
}

function customerOverview(orders: ReportOrder[]) {
  const validOrders = orders.filter((order) => order.status !== "CANCELLED");
  const customers = new Map<string, ReportTopCustomer & { items: number }>();

  for (const order of validOrders) {
    const key = order.customerId ?? order.customerEmail ?? order.customerPhone;
    const customer = customers.get(key) ?? { items: 0, name: order.customerName, orders: 0, purchased: 0 };
    customer.orders += 1;
    customer.purchased += Number(order.totalAmount);
    customer.items += sum(order.items.map((item) => item.quantity));
    customers.set(key, customer);
  }

  const customerCount = customers.size;
  const totalRevenue = sum(validOrders.map((order) => Number(order.totalAmount)));
  const totalItems = sum(validOrders.flatMap((order) => order.items.map((item) => item.quantity)));

  return {
    aov: customerCount ? totalRevenue / customerCount : 0,
    itemsPerCustomer: customerCount ? totalItems / customerCount : 0,
    ordersPerCustomer: customerCount ? validOrders.length / customerCount : 0,
    topCustomers: [...customers.values()]
      .sort((a, b) => b.purchased - a.purchased)
      .slice(0, 5)
      .map(({ name, orders: orderCount, purchased }) => ({ name, orders: orderCount, purchased }))
  };
}

function metric(value: number, previous: number) {
  return {
    change: previous === 0 ? (value === 0 ? 0 : 100) : ((value - previous) / previous) * 100,
    value
  };
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
