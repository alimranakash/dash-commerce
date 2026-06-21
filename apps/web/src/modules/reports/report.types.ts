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
