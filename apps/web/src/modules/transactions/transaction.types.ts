export type TransactionType = "PAYMENT" | "REFUND" | "ADJUSTMENT";

export type TransactionRow = {
  amount: number;
  createdAt: Date;
  currency: string;
  customer: string;
  id: string;
  orderId: string;
  orderNumber: string;
  status: string;
  type: TransactionType;
};

export type TransactionSummary = {
  metrics: { netAmount: number; payments: number; refunds: number; total: number };
  rows: TransactionRow[];
};
