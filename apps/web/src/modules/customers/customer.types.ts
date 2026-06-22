export type CustomerRow = {
  createdAt: Date;
  currency: string;
  email: string | null;
  id: string;
  lastOrderAt: Date | null;
  name: string;
  orderCount: number;
  phone: string;
  totalSpent: number;
};

export type CustomerSummary = {
  metrics: { averageValue: number; newCustomers: number; returning: number; total: number };
  rows: CustomerRow[];
};
