import {
  getDashboardMetrics,
  getLowStockProducts,
  getRecentOrders,
  getTopProducts
} from "../analytics/analytics.service";
import {
  getAbandonedCartsReport,
  getCustomersReport,
  getIncompleteOrdersReport,
  getMerchandisingReport,
  getOrdersReport,
  getProductsReport,
  getReportOverview,
  getRevenuesReport
} from "../reports/report.service";
import type { ReportRangeKey } from "../reports/report.types";
import { getStoreIdentityById } from "../stores/store.repository";
import { toIsoString } from "./ai-redact";
import {
  AI_REPORT_SCHEMAS,
  aiMetricsResponseSchema,
  aiReportResponseSchema,
  type AiMetricsResponse,
  type AiReportKey,
  type AiReportResponse
} from "./ai.schema";

/**
 * Aggregates, for the questions an assistant is actually asked.
 *
 * Not one line of arithmetic here. Every number comes from
 * `analytics.service.ts` or `report.service.ts` — the same functions that draw
 * the seller's own dashboard — because the moment this file computed a total of
 * its own, the AI and the dashboard could quote different revenue for the same
 * day, and the seller would have no way to tell which was lying.
 *
 * What this file does is shape and validate: ISO strings for dates, strings for
 * money, and a Zod parse on the way out so the response is an allow-list rather
 * than whatever the report happens to return.
 */

export async function getAiMetrics(storeId: string): Promise<AiMetricsResponse> {
  const [store, summary, recentOrders, topProducts, lowStockProducts] = await Promise.all([
    getStoreIdentityById(storeId),
    getDashboardMetrics(storeId),
    getRecentOrders(storeId),
    getTopProducts(storeId),
    getLowStockProducts(storeId)
  ]);

  return aiMetricsResponseSchema.parse({
    currency: store?.currency ?? "BDT",
    lowStockProducts: lowStockProducts.map((product) => ({
      id: product.id,
      lowStockThreshold: product.lowStockThreshold,
      stockQuantity: product.stockQuantity,
      title: product.title
    })),
    recentOrders: recentOrders.map((order) => ({
      createdAt: toIsoString(order.createdAt),
      currency: order.currency,
      customerName: order.customerName,
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: order.totalAmount
    })),
    storeId,
    summary: {
      lowStockProducts: summary.lowStockProducts,
      pendingOrders: summary.pendingOrders,
      thisMonthRevenue: summary.thisMonthRevenue,
      todayRevenue: summary.todayRevenue,
      totalOrders: summary.totalOrders,
      totalProducts: summary.totalProducts
    },
    topProducts: topProducts.map((product) => ({
      productId: product.productId,
      quantitySold: product.quantitySold,
      revenue: product.revenue,
      title: product.title
    }))
  });
}

/**
 * One loader per report key, and no way to reach anything that is not in this
 * table.
 *
 * The key is a closed enum validated before it gets here, so this is a lookup
 * rather than a dispatch — there is deliberately no path by which a caller's
 * string becomes a function name, a table name, or a query.
 */
const reportLoaders: Record<
  AiReportKey,
  (storeId: string, currency: string, range: ReportRangeKey) => Promise<unknown>
> = {
  "abandoned-carts": getAbandonedCartsReport,
  customers: getCustomersReport,
  "incomplete-orders": getIncompleteOrdersReport,
  merchandising: getMerchandisingReport,
  orders: getOrdersReport,
  overview: getReportOverview,
  products: getProductsReport,
  revenues: getRevenuesReport
};

export async function getAiReport(
  storeId: string,
  key: AiReportKey,
  range: ReportRangeKey
): Promise<AiReportResponse> {
  const store = await getStoreIdentityById(storeId);

  if (!store) {
    return aiReportResponseSchema.parse({ data: null, key, range, storeId });
  }

  const data = await reportLoaders[key](storeId, store.currency, range);

  return aiReportResponseSchema.parse({
    // Parsed by the report's own schema first, so `data` is an allow-listed
    // object by the time the envelope sees it as `unknown`.
    data: AI_REPORT_SCHEMAS[key].parse(normalizeReportDates(key, data)),
    key,
    range,
    storeId
  });
}

/**
 * The orders report is the only one that carries a `Date` — every other report
 * is already numbers and labels. Converted here rather than by a generic deep
 * walk, because a walk that rewrites anything date-shaped is a walk that will
 * one day rewrite something else.
 */
function normalizeReportDates(key: AiReportKey, data: unknown) {
  if (key !== "orders") {
    return data;
  }

  const report = data as { recentOrders: Array<{ createdAt: Date }> };

  return {
    ...report,
    recentOrders: report.recentOrders.map((order) => ({
      ...order,
      createdAt: toIsoString(order.createdAt)
    }))
  };
}
