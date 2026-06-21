export type DashboardMetrics = {
  lowStockProducts: number;
  pendingOrders: number;
  thisMonthRevenue: string;
  todayRevenue: string;
  totalOrders: number;
  totalProducts: number;
};

export type DashboardRecentOrder = {
  createdAt: Date;
  currency: string;
  customerName: string;
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: string;
};

export type DashboardTopProduct = {
  productId: string;
  revenue: string;
  title: string;
  quantitySold: number;
};

export type DashboardLowStockProduct = {
  id: string;
  lowStockThreshold: number;
  stockQuantity: number;
  title: string;
};
