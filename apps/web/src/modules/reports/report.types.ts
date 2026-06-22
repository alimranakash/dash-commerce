export type ReportMetric = {
  change: number;
  value: number;
};

export type ReportDailyPoint = {
  date: string;
  label: string;
  netRevenue: number;
  orderCount: number;
  refundCount: number;
  refunds: number;
  sales: number;
};

export type ReportTopProduct = {
  quantity: number;
  revenue: number;
  title: string;
};

export type ReportTopCustomer = {
  name: string;
  orders: number;
  purchased: number;
};

export type ReportOverviewData = {
  currency: string;
  customers: ReportMetric;
  customerOverview: {
    aov: number;
    itemsPerCustomer: number;
    ordersPerCustomer: number;
    topCustomers: ReportTopCustomer[];
  };
  daily: ReportDailyPoint[];
  netRevenue: ReportMetric;
  orders: ReportMetric;
  orderStatuses: Array<{ count: number; label: string }>;
  productsSold: ReportMetric;
  productStats: {
    averagePrice: number;
    inventoryCount: number;
    productsInCatalog: number;
    variations: number;
  };
  refunds: ReportMetric;
  sales: ReportMetric;
  topProducts: ReportTopProduct[];
};

export type ReportSeriesPoint = { label: string; value: number; secondary?: number };

export type OrdersReportData = {
  currency: string;
  daily: ReportSeriesPoint[];
  metrics: Record<"total" | "pending" | "processing" | "completed" | "cancelled" | "refunded", number>;
  monthly: ReportSeriesPoint[];
  recentOrders: Array<{ createdAt: Date; customer: string; id: string; orderNumber: string; status: string; total: number }>;
  statuses: Array<{ label: string; value: number }>;
};

export type RevenuesReportData = {
  currency: string;
  daily: ReportSeriesPoint[];
  metrics: { aov: number; gross: number; net: number; refunds: number };
  monthly: ReportSeriesPoint[];
  topDays: Array<{ date: string; orders: number; revenue: number }>;
};

export type ProductsReportData = {
  categoryPerformance: Array<{ category: string; quantity: number; revenue: number }>;
  currency: string;
  inventory: Array<{ label: string; value: number }>;
  lowStock: Array<{ id: string; stock: number; threshold: number; title: string }>;
  metrics: { active: number; lowStock: number; outOfStock: number; total: number };
  topProducts: ReportTopProduct[];
};

export type CustomersReportData = {
  currency: string;
  frequency: Array<{ label: string; value: number }>;
  growth: ReportSeriesPoint[];
  metrics: { averageValue: number; newCustomers: number; returning: number; total: number };
  topCustomers: ReportTopCustomer[];
};
