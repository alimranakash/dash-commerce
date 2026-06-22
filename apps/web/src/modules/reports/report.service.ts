import { getCustomersReportRecords, getOrdersReportRecords, getProductsReportRecords, getReportOverviewRecords, getRevenueReportRecords } from "./report.repository";
import type { AbandonedCartsReportData, CustomersReportData, OrdersReportData, ProductsReportData, ReportOverviewData, ReportSeriesPoint, ReportTopCustomer, ReportTopProduct, RevenuesReportData } from "./report.types";

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

export async function getOrdersReport(storeId: string, fallbackCurrency: string): Promise<OrdersReportData> {
  const start = startOfMonthOffset(-11);
  const orders = await getOrdersReportRecords(storeId, start);
  const currency = orders[0]?.currency ?? fallbackCurrency;
  const recentStart = startOfDay(daysAgo(29));
  const recent = orders.filter((order) => order.createdAt >= recentStart);

  return {
    currency,
    daily: timeSeries(30, "day", recentStart, recent, () => 1),
    metrics: {
      total: orders.length,
      pending: orders.filter((order) => order.status === "PENDING").length,
      processing: orders.filter((order) => order.status === "CONFIRMED" || order.status === "PROCESSING").length,
      completed: orders.filter((order) => order.status === "COMPLETED").length,
      cancelled: orders.filter((order) => order.status === "CANCELLED").length,
      refunded: orders.filter((order) => order.paymentStatus === "REFUNDED").length
    },
    monthly: timeSeries(12, "month", start, orders, () => 1),
    recentOrders: [...orders].reverse().slice(0, 8).map((order) => ({ createdAt: order.createdAt, customer: order.customerName, id: order.id, orderNumber: order.orderNumber, status: order.status, total: Number(order.totalAmount) })),
    statuses: ["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"].map((status) => ({ label: titleCase(status), value: orders.filter((order) => order.status === status).length }))
  };
}

export async function getRevenuesReport(storeId: string, fallbackCurrency: string): Promise<RevenuesReportData> {
  const start = startOfMonthOffset(-11);
  const orders = await getRevenueReportRecords(storeId, start);
  const currency = orders[0]?.currency ?? fallbackCurrency;
  const valid = orders.filter((order) => order.status !== "CANCELLED");
  const gross = sum(valid.map((order) => Number(order.totalAmount)));
  const refunds = sum(valid.filter((order) => order.paymentStatus === "REFUNDED").map((order) => Number(order.totalAmount)));
  const recentStart = startOfDay(daysAgo(29));
  const recent = valid.filter((order) => order.createdAt >= recentStart);
  const daily = timeSeries(30, "day", recentStart, recent, (order) => Number(order.totalAmount), (order) => order.paymentStatus === "REFUNDED" ? Number(order.totalAmount) : 0);

  return {
    currency,
    daily,
    metrics: { aov: valid.length ? gross / valid.length : 0, gross, net: Math.max(0, gross - refunds), refunds },
    monthly: timeSeries(12, "month", start, valid, (order) => Number(order.totalAmount), (order) => order.paymentStatus === "REFUNDED" ? Number(order.totalAmount) : 0),
    topDays: daily.map((point) => ({ date: point.label, orders: recent.filter((order) => dayLabel(order.createdAt) === point.label).length, revenue: point.value })).sort((a, b) => b.revenue - a.revenue).slice(0, 7)
  };
}

export async function getProductsReport(storeId: string, fallbackCurrency: string): Promise<ProductsReportData> {
  const [products, items] = await getProductsReportRecords(storeId);
  const byProduct = new Map<string, ReportTopProduct>();
  const categories = new Map<string, { category: string; quantity: number; revenue: number }>();

  for (const item of items) {
    const key = item.productId ?? item.title;
    const product = byProduct.get(key) ?? { quantity: 0, revenue: 0, title: item.title };
    product.quantity += item.quantity;
    product.revenue += Number(item.total);
    byProduct.set(key, product);
    const categoryName = item.product?.category?.name ?? "Uncategorized";
    const category = categories.get(categoryName) ?? { category: categoryName, quantity: 0, revenue: 0 };
    category.quantity += item.quantity;
    category.revenue += Number(item.total);
    categories.set(categoryName, category);
  }

  return {
    categoryPerformance: [...categories.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8),
    currency: fallbackCurrency,
    inventory: [
      { label: "In Stock", value: products.filter((product) => product.stockQuantity > product.lowStockThreshold).length },
      { label: "Low Stock", value: products.filter((product) => product.stockQuantity > 0 && product.stockQuantity <= product.lowStockThreshold).length },
      { label: "Out of Stock", value: products.filter((product) => product.stockQuantity === 0).length }
    ],
    lowStock: products.filter((product) => product.stockQuantity <= product.lowStockThreshold).map((product) => ({ id: product.id, stock: product.stockQuantity, threshold: product.lowStockThreshold, title: product.title })).slice(0, 10),
    metrics: {
      active: products.filter((product) => product.status === "ACTIVE").length,
      lowStock: products.filter((product) => product.stockQuantity > 0 && product.stockQuantity <= product.lowStockThreshold).length,
      outOfStock: products.filter((product) => product.stockQuantity === 0).length,
      total: products.length
    },
    topProducts: [...byProduct.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 8)
  };
}

export async function getCustomersReport(storeId: string, fallbackCurrency: string): Promise<CustomersReportData> {
  const customers = await getCustomersReportRecords(storeId);
  const recentStart = startOfDay(daysAgo(29));
  const customerSummaries = customers.map((customer) => ({ name: customer.name, orders: customer.orders.length, purchased: sum(customer.orders.map((order) => Number(order.totalAmount))) }));
  const topCustomers = [...customerSummaries].sort((a, b) => b.purchased - a.purchased).slice(0, 10);
  const totalRevenue = sum(customerSummaries.map((customer) => customer.purchased));

  return {
    currency: customers.flatMap((customer) => customer.orders)[0]?.currency ?? fallbackCurrency,
    frequency: [
      { label: "1 Order", value: customers.filter((customer) => customer.orders.length === 1).length },
      { label: "2-3 Orders", value: customers.filter((customer) => customer.orders.length >= 2 && customer.orders.length <= 3).length },
      { label: "4+ Orders", value: customers.filter((customer) => customer.orders.length >= 4).length }
    ],
    growth: timeSeries(30, "day", recentStart, customers.filter((customer) => customer.createdAt >= recentStart), () => 1),
    metrics: {
      averageValue: customers.length ? totalRevenue / customers.length : 0,
      newCustomers: customers.filter((customer) => customer.createdAt >= recentStart).length,
      returning: customers.filter((customer) => customer.orders.length > 1).length,
      total: customers.length
    },
    topCustomers
  };
}

export async function getAbandonedCartsReport(storeId: string, fallbackCurrency: string): Promise<AbandonedCartsReportData> {
  // Abandoned cart persistence is not available yet. Keep the report contract
  // store-scoped so real repository data can replace this empty source later.
  void storeId;
  const start = startOfDay(daysAgo(29));
  const daily = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return { abandoned: 0, label: dayLabel(date), lostRevenue: 0, recovered: 0, recoveredRevenue: 0, recoveryRate: 0 };
  });

  return {
    currency: fallbackCurrency,
    daily,
    metrics: { lostRevenue: 0, recoveredRevenue: 0, recoveryRate: 0, total: 0 },
    recoveryChannels: []
  };
}

function timeSeries<T extends { createdAt: Date }>(
  length: number,
  unit: "day" | "month",
  start: Date,
  records: T[],
  value: (record: T) => number,
  secondary: (record: T) => number = () => 0
): ReportSeriesPoint[] {
  const points = Array.from({ length }, (_, index) => {
    const date = new Date(start);
    if (unit === "day") date.setDate(date.getDate() + index);
    else date.setMonth(date.getMonth() + index);
    return { date, label: unit === "day" ? dayLabel(date) : monthLabel(date), secondary: 0, value: 0 };
  });

  for (const record of records) {
    const index = unit === "day"
      ? Math.floor((startOfDay(record.createdAt).getTime() - start.getTime()) / 86_400_000)
      : (record.createdAt.getFullYear() - start.getFullYear()) * 12 + record.createdAt.getMonth() - start.getMonth();
    const point = points[index];
    if (!point) continue;
    point.value += value(record);
    point.secondary = (point.secondary ?? 0) + secondary(record);
  }

  return points.map(({ label, secondary: secondaryValue, value: primaryValue }) => ({ label, secondary: secondaryValue, value: primaryValue }));
}

function startOfMonthOffset(offset: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

function dayLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(date);
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(date);
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
