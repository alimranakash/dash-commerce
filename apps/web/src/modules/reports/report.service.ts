import {
  getAbandonedCartReportRecords,
  getIncompleteOrderReportRecords
} from "../abandoned-carts/abandoned-cart.repository";
import { getAbandonedCartCutoff } from "../abandoned-carts/abandoned-cart.service";
import { incompleteOrderFailureLabels } from "../abandoned-carts/incomplete-order-labels";
import type { IncompleteOrderFailureCode } from "../abandoned-carts/abandoned-cart.types";
import { getBundleReportRecords, getCustomersReportRecords, getMerchandisingReportRecords, getOrdersReportRecords, getProductsReportRecords, getReportOverviewRecords, getRevenueReportRecords } from "./report.repository";
import { MERCHANDISING_SOURCE_LABELS, type AbandonedCartsReportData, type CustomersReportData, type IncompleteOrdersReportData, type MerchandisingReportData, type MerchandisingSourceKey, type OrdersReportData, type ProductsReportData, type ReportOverviewData, type ReportRangeKey, type ReportSeriesPoint, type ReportTopCustomer, type ReportTopProduct, type RevenuesReportData } from "./report.types";

type ReportWindow = {
  length: number;
  start: Date;
  unit: "day" | "month";
};

function reportWindow(range: ReportRangeKey): ReportWindow {
  if (range === "12m") {
    return { length: 12, start: startOfMonthOffset(-11), unit: "month" };
  }

  const days = range === "90d" ? 90 : 30;

  return { length: days, start: startOfDay(daysAgo(days - 1)), unit: "day" };
}

function previousWindowStart(range: ReportRangeKey, window: ReportWindow) {
  return range === "12m" ? startOfMonthOffset(-23) : startOfDay(daysAgo(window.length * 2 - 1));
}

export async function getReportOverview(storeId: string, fallbackCurrency: string, range: ReportRangeKey = "30d"): Promise<ReportOverviewData> {
  const window = reportWindow(range);
  const currentStart = window.start;
  const previousStart = previousWindowStart(range, window);
  const [orders, products, customers, variations] = await getReportOverviewRecords(storeId, previousStart);
  const currentOrders = orders.filter((order) => order.createdAt >= currentStart);
  const previousOrders = orders.filter((order) => order.createdAt < currentStart);
  const newCustomerIds = new Set(customers.filter((customer) => customer.createdAt >= currentStart).map((customer) => customer.id));
  const currentCustomers = newCustomerIds.size;
  const previousCustomers = customers.filter((customer) => customer.createdAt >= previousStart && customer.createdAt < currentStart).length;
  const current = summarizeOrders(currentOrders);
  const previous = summarizeOrders(previousOrders);
  const currency = currentOrders[0]?.currency ?? orders[0]?.currency ?? fallbackCurrency;

  return {
    currency,
    customers: metric(currentCustomers, previousCustomers),
    customerOverview: customerOverview(currentOrders),
    daily: dailySeries(currentOrders, window, newCustomerIds),
    netRevenue: metric(current.netRevenue, previous.netRevenue),
    orders: metric(current.orderCount, previous.orderCount),
    orderStatuses: orderStatuses(currentOrders),
    productsSold: metric(current.productsSold, previous.productsSold),
    productStats: {
      averagePrice: Number(products._avg.price ?? 0),
      inventoryCount: products._sum.stockQuantity ?? 0,
      productsInCatalog: products._count._all,
      variations
    },
    refunds: metric(current.refunds, previous.refunds),
    sales: metric(current.sales, previous.sales),
    topProducts: topProducts(currentOrders)
  };
}

export async function getOrdersReport(storeId: string, fallbackCurrency: string, range: ReportRangeKey = "30d"): Promise<OrdersReportData> {
  const window = reportWindow(range);
  const monthlyStart = startOfMonthOffset(-11);
  const allOrders = await getOrdersReportRecords(storeId, window.start < monthlyStart ? window.start : monthlyStart);
  const orders = allOrders.filter((order) => order.createdAt >= window.start);
  const currency = orders[0]?.currency ?? allOrders[0]?.currency ?? fallbackCurrency;

  return {
    currency,
    daily: timeSeries(window.length, window.unit, window.start, orders, () => 1),
    metrics: {
      total: orders.length,
      pending: orders.filter((order) => order.status === "PENDING").length,
      processing: orders.filter((order) => order.status === "CONFIRMED" || order.status === "PROCESSING").length,
      completed: orders.filter((order) => order.status === "COMPLETED").length,
      cancelled: orders.filter((order) => order.status === "CANCELLED").length,
      refunded: orders.filter((order) => order.paymentStatus === "REFUNDED").length
    },
    monthly: timeSeries(12, "month", monthlyStart, allOrders.filter((order) => order.createdAt >= monthlyStart), () => 1),
    recentOrders: [...orders].reverse().slice(0, 8).map((order) => ({ createdAt: order.createdAt, customer: order.customerName, id: order.id, orderNumber: order.orderNumber, status: order.status, total: Number(order.totalAmount) })),
    statuses: ["PENDING", "CONFIRMED", "PROCESSING", "COMPLETED", "CANCELLED"].map((status) => ({ label: titleCase(status), value: orders.filter((order) => order.status === status).length }))
  };
}

export async function getRevenuesReport(storeId: string, fallbackCurrency: string, range: ReportRangeKey = "30d"): Promise<RevenuesReportData> {
  const window = reportWindow(range);
  const monthlyStart = startOfMonthOffset(-11);
  const allOrders = await getRevenueReportRecords(storeId, window.start < monthlyStart ? window.start : monthlyStart);
  const currency = allOrders[0]?.currency ?? fallbackCurrency;
  const allValid = allOrders.filter((order) => order.status !== "CANCELLED");
  const valid = allValid.filter((order) => order.createdAt >= window.start);
  const gross = sum(valid.map((order) => Number(order.totalAmount)));
  const refunds = sum(valid.filter((order) => order.paymentStatus === "REFUNDED").map((order) => Number(order.totalAmount)));
  const daily = timeSeries(window.length, window.unit, window.start, valid, (order) => Number(order.totalAmount), (order) => order.paymentStatus === "REFUNDED" ? Number(order.totalAmount) : 0);
  const seriesLabel = window.unit === "day" ? dayLabel : monthLabel;

  return {
    currency,
    daily,
    metrics: { aov: valid.length ? gross / valid.length : 0, gross, net: Math.max(0, gross - refunds), refunds },
    monthly: timeSeries(12, "month", monthlyStart, allValid.filter((order) => order.createdAt >= monthlyStart), (order) => Number(order.totalAmount), (order) => order.paymentStatus === "REFUNDED" ? Number(order.totalAmount) : 0),
    topDays: daily.map((point) => ({ date: point.label, orders: valid.filter((order) => seriesLabel(order.createdAt) === point.label).length, revenue: point.value })).sort((a, b) => b.revenue - a.revenue).slice(0, 7)
  };
}

export async function getProductsReport(storeId: string, fallbackCurrency: string, range: ReportRangeKey = "30d"): Promise<ProductsReportData> {
  const [products, items] = await getProductsReportRecords(storeId, reportWindow(range).start);
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

export async function getCustomersReport(storeId: string, fallbackCurrency: string, range: ReportRangeKey = "30d"): Promise<CustomersReportData> {
  const customers = await getCustomersReportRecords(storeId);
  const window = reportWindow(range);
  const recentStart = window.start;
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
    growth: timeSeries(window.length, window.unit, recentStart, customers.filter((customer) => customer.createdAt >= recentStart), () => 1),
    metrics: {
      averageValue: customers.length ? totalRevenue / customers.length : 0,
      newCustomers: customers.filter((customer) => customer.createdAt >= recentStart).length,
      returning: customers.filter((customer) => customer.orders.length > 1).length,
      total: customers.length
    },
    topCustomers
  };
}

/**
 * How many checkouts were filled in and never placed, and what stopped them.
 *
 * A sibling of the abandoned-cart report rather than a section of it: the two
 * measure different halves of the funnel, and only this one can answer the
 * question a seller actually acts on — whether the orders are being lost to
 * their own settings or to the shoppers changing their minds.
 */
export async function getIncompleteOrdersReport(storeId: string, fallbackCurrency: string, range: ReportRangeKey = "30d"): Promise<IncompleteOrdersReportData> {
  const window = reportWindow(range);
  const orders = await getIncompleteOrderReportRecords(storeId, window.start, getAbandonedCartCutoff());
  // Bucketed by last activity, the same as carts are, so a day's recovery rate
  // compares like for like against the day the checkout was given up on.
  const daily = Array.from({ length: window.length }, (_, index) => {
    const date = new Date(window.start);
    if (window.unit === "day") date.setDate(date.getDate() + index);
    else date.setMonth(date.getMonth() + index);
    const label = window.unit === "day" ? dayLabel(date) : monthLabel(date);
    const bucket = orders.filter((order) => (window.unit === "day" ? dayLabel(order.lastActivityAt) : monthLabel(order.lastActivityAt)) === label);
    const recovered = bucket.filter((order) => order.status === "RECOVERED");
    const lost = bucket.filter((order) => order.status !== "RECOVERED");

    return {
      failed: bucket.filter((order) => order.stage === "CHECKOUT_FAILED").length,
      incomplete: bucket.length,
      label,
      lostRevenue: sumCartValue(lost),
      recovered: recovered.length,
      recoveredRevenue: sumCartValue(recovered),
      recoveryRate: bucket.length ? (recovered.length / bucket.length) * 100 : 0
    };
  });
  const recoveredOrders = orders.filter((order) => order.status === "RECOVERED");
  const channelLabels: Record<string, string> = { email: "Email", manual: "Manual outreach", whatsapp: "WhatsApp" };
  const channelCounts = new Map<string, number>();
  const failureCounts = new Map<string, number>();

  for (const order of recoveredOrders) {
    const label = channelLabels[order.contactChannel ?? ""] ?? "Returned on their own";
    channelCounts.set(label, (channelCounts.get(label) ?? 0) + 1);
  }

  for (const order of orders) {
    if (!order.failureCode) {
      continue;
    }

    // An unrecognised code — one written by an older build — reads as "Other"
    // rather than as a raw enum name nobody outside the codebase knows.
    const label = incompleteOrderFailureLabels[order.failureCode as IncompleteOrderFailureCode] ?? incompleteOrderFailureLabels.UNKNOWN;
    failureCounts.set(label, (failureCounts.get(label) ?? 0) + 1);
  }

  return {
    currency: fallbackCurrency,
    daily,
    failureReasons: sortedCounts(failureCounts),
    metrics: {
      failed: orders.filter((order) => order.stage === "CHECKOUT_FAILED").length,
      lostRevenue: sumCartValue(orders.filter((order) => order.status !== "RECOVERED")),
      recoveredRevenue: sumCartValue(recoveredOrders),
      recoveryRate: orders.length ? (recoveredOrders.length / orders.length) * 100 : 0,
      total: orders.length
    },
    recoveryChannels: sortedCounts(channelCounts)
  };
}

function sortedCounts(counts: Map<string, number>) {
  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((first, second) => second.value - first.value);
}

export async function getAbandonedCartsReport(storeId: string, fallbackCurrency: string, range: ReportRangeKey = "30d"): Promise<AbandonedCartsReportData> {
  const window = reportWindow(range);
  const carts = await getAbandonedCartReportRecords(storeId, window.start, getAbandonedCartCutoff());
  // Bucketed by when a cart went quiet, which is the moment it became abandoned;
  // a recovery lands in the same bucket so a day's rate compares like for like.
  const daily = Array.from({ length: window.length }, (_, index) => {
    const date = new Date(window.start);
    if (window.unit === "day") date.setDate(date.getDate() + index);
    else date.setMonth(date.getMonth() + index);
    const label = window.unit === "day" ? dayLabel(date) : monthLabel(date);
    const bucket = carts.filter((cart) => (window.unit === "day" ? dayLabel(cart.lastActivityAt) : monthLabel(cart.lastActivityAt)) === label);
    const recovered = bucket.filter((cart) => cart.status === "RECOVERED");
    const lost = bucket.filter((cart) => cart.status !== "RECOVERED");

    return {
      abandoned: bucket.length,
      label,
      lostRevenue: sumCartValue(lost),
      recovered: recovered.length,
      recoveredRevenue: sumCartValue(recovered),
      recoveryRate: bucket.length ? (recovered.length / bucket.length) * 100 : 0
    };
  });
  const recoveredCarts = carts.filter((cart) => cart.status === "RECOVERED");
  const channelLabels: Record<string, string> = { email: "Email", manual: "Manual outreach", whatsapp: "WhatsApp" };
  const channelCounts = new Map<string, number>();

  for (const cart of recoveredCarts) {
    const label = channelLabels[cart.contactChannel ?? ""] ?? "Returned on their own";
    channelCounts.set(label, (channelCounts.get(label) ?? 0) + 1);
  }

  return {
    currency: fallbackCurrency,
    daily,
    metrics: {
      lostRevenue: sumCartValue(carts.filter((cart) => cart.status !== "RECOVERED")),
      recoveredRevenue: sumCartValue(recoveredCarts),
      recoveryRate: carts.length ? (recoveredCarts.length / carts.length) * 100 : 0,
      total: carts.length
    },
    recoveryChannels: sortedCounts(channelCounts)
  };
}

function sumCartValue(carts: Array<{ subtotalAmount: unknown }>) {
  return carts.reduce((total, cart) => total + Number(cart.subtotalAmount), 0);
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


/**
 * What the merchandising surfaces earned, as against what the shopper came for.
 *
 * Every figure here is revenue that would plausibly not exist without the
 * suggestion — so it is deliberately conservative: a line only counts once, it
 * counts at what it actually sold for, and a cancelled order counts for
 * nothing.
 */
export async function getMerchandisingReport(storeId: string, fallbackCurrency: string, range: ReportRangeKey = "30d"): Promise<MerchandisingReportData> {
  const window = reportWindow(range);
  const [items, bundleRows] = await Promise.all([
    getMerchandisingReportRecords(storeId, window.start),
    getBundleReportRecords(storeId, window.start)
  ]);
  const daily = Array.from({ length: window.length }, (_, index) => {
    const date = new Date(window.start);
    if (window.unit === "day") date.setDate(date.getDate() + index);
    else date.setMonth(date.getMonth() + index);
    const label = window.unit === "day" ? dayLabel(date) : monthLabel(date);
    const bucket = items.filter((item) => (window.unit === "day" ? dayLabel(item.order.createdAt) : monthLabel(item.order.createdAt)) === label);

    return {
      crossSell: sumLineTotals(bucket, "CART_CROSS_SELL"),
      label,
      orderBump: sumLineTotals(bucket, "ORDER_BUMP")
    };
  });
  const suggested = items.filter((item) => item.source !== "CART");
  // Orders rather than lines: two suggestions taken in one order is still one
  // shopper who said yes, and an attach rate counted per line would climb past
  // 100% the moment anyone took two.
  const ordersWithSuggestion = new Set(suggested.map((item) => item.order.id));
  const allOrders = new Set(items.map((item) => item.order.id));
  const topSuggested = new Map<string, { quantity: number; revenue: number; source: string; title: string }>();

  for (const item of suggested) {
    const key = `${item.source}::${item.title}`;
    const entry = topSuggested.get(key) ?? {
      quantity: 0,
      revenue: 0,
      source: MERCHANDISING_SOURCE_LABELS[item.source as MerchandisingSourceKey] ?? item.source,
      title: item.title
    };

    entry.quantity += item.quantity;
    entry.revenue += Number(item.total);
    topSuggested.set(key, entry);
  }

  const bundleTotals = new Map<string, { name: string; savings: number; timesApplied: number }>();

  for (const row of bundleRows) {
    const entry = bundleTotals.get(row.name) ?? { name: row.name, savings: 0, timesApplied: 0 };

    entry.savings += Number(row.discountAmount);
    entry.timesApplied += row.timesApplied;
    bundleTotals.set(row.name, entry);
  }

  return {
    currency: fallbackCurrency,
    daily,
    metrics: {
      attachRate: allOrders.size ? (ordersWithSuggestion.size / allOrders.size) * 100 : 0,
      bundleOrders: new Set(bundleRows.map((row) => row.orderId)).size,
      bundleSavings: bundleRows.reduce((total, row) => total + Number(row.discountAmount), 0),
      crossSellRevenue: sumLineTotals(items, "CART_CROSS_SELL"),
      crossSellUnits: sumUnits(items, "CART_CROSS_SELL"),
      orderBumpRevenue: sumLineTotals(items, "ORDER_BUMP"),
      orderBumpUnits: sumUnits(items, "ORDER_BUMP"),
      suggestedRevenue: suggested.reduce((total, item) => total + Number(item.total), 0)
    },
    topBundles: [...bundleTotals.values()].sort((first, second) => second.savings - first.savings).slice(0, 10),
    topSuggested: [...topSuggested.values()].sort((first, second) => second.revenue - first.revenue).slice(0, 10),
    totalRevenue: items.reduce((total, item) => total + Number(item.total), 0)
  };
}

function sumLineTotals(items: Array<{ source: string; total: { toString(): string } }>, source: MerchandisingSourceKey) {
  return items.filter((item) => item.source === source).reduce((total, item) => total + Number(item.total), 0);
}

function sumUnits(items: Array<{ quantity: number; source: string }>, source: MerchandisingSourceKey) {
  return items.filter((item) => item.source === source).reduce((total, item) => total + item.quantity, 0);
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

function dailySeries(orders: ReportOrder[], window: ReportWindow, newCustomerIds: Set<string>) {
  const points = Array.from({ length: window.length }, (_, index) => {
    const date = new Date(window.start);
    if (window.unit === "day") date.setDate(date.getDate() + index);
    else date.setMonth(date.getMonth() + index);
    return {
      date: periodKey(date, window.unit),
      label: window.unit === "day" ? dayLabel(date) : monthLabel(date),
      netRevenue: 0,
      newCustomerOrders: 0,
      orderCount: 0,
      refundCount: 0,
      refunds: 0,
      returningCustomerOrders: 0,
      sales: 0
    };
  });
  const byDate = new Map(points.map((point) => [point.date, point]));

  for (const order of orders) {
    const point = byDate.get(periodKey(order.createdAt, window.unit));
    if (!point) continue;
    point.orderCount += 1;
    // Guest orders have no customer record, so they cannot be proven returning.
    if (!order.customerId || newCustomerIds.has(order.customerId)) point.newCustomerOrders += 1;
    else point.returningCustomerOrders += 1;
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

function periodKey(date: Date, unit: "day" | "month") {
  const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  // Local calendar parts, not toISOString(): UTC conversion shifts orders into the
  // wrong bucket for every store outside UTC.
  return unit === "month" ? month : `${month}-${String(date.getDate()).padStart(2, "0")}`;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}
