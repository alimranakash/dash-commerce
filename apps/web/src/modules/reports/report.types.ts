export type ReportRangeKey = "30d" | "90d" | "12m";

export const REPORT_RANGE_OPTIONS: Array<{ key: ReportRangeKey; label: string }> = [
  { key: "30d", label: "Last 30 days" },
  { key: "90d", label: "Last 90 days" },
  { key: "12m", label: "Last 12 months" }
];

export const REPORT_COMPARISON_LABELS: Record<ReportRangeKey, string> = {
  "12m": "Prev. 12 months",
  "30d": "Prev. 30 days",
  "90d": "Prev. 90 days"
};

export function parseReportRange(value: string | string[] | undefined): ReportRangeKey {
  const raw = Array.isArray(value) ? value[0] : value;

  return REPORT_RANGE_OPTIONS.some((option) => option.key === raw) ? (raw as ReportRangeKey) : "30d";
}

export type ReportMetric = {
  change: number;
  value: number;
};

export type ReportDailyPoint = {
  date: string;
  label: string;
  netRevenue: number;
  newCustomerOrders: number;
  orderCount: number;
  refundCount: number;
  refunds: number;
  returningCustomerOrders: number;
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

export type AbandonedCartsReportData = {
  currency: string;
  daily: Array<{
    abandoned: number;
    label: string;
    lostRevenue: number;
    recovered: number;
    recoveredRevenue: number;
    recoveryRate: number;
  }>;
  metrics: {
    lostRevenue: number;
    recoveredRevenue: number;
    recoveryRate: number;
    total: number;
  };
  recoveryChannels: Array<{ label: string; value: number }>;
};
