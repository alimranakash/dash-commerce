import {
  getDashboardMetricsRecord,
  getLowStockProductsRecord,
  getRecentOrdersRecord,
  getTopProductsRecord
} from "./analytics.repository";
import type {
  DashboardLowStockProduct,
  DashboardMetrics,
  DashboardRecentOrder,
  DashboardTopProduct
} from "./analytics.types";

export async function getDashboardMetrics(storeId: string): Promise<DashboardMetrics> {
  return getDashboardMetricsRecord(storeId);
}

export async function getRecentOrders(storeId: string): Promise<DashboardRecentOrder[]> {
  const orders = await getRecentOrdersRecord(storeId);

  return orders.map((order) => ({
    ...order,
    totalAmount: order.totalAmount.toString()
  }));
}

export async function getTopProducts(storeId: string): Promise<DashboardTopProduct[]> {
  return getTopProductsRecord(storeId);
}

export async function getLowStockProducts(storeId: string): Promise<DashboardLowStockProduct[]> {
  return getLowStockProductsRecord(storeId);
}
