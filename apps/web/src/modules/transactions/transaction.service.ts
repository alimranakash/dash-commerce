import { getTransactionSourceOrders } from "./transaction.repository";
import type { TransactionRow, TransactionSummary } from "./transaction.types";

export async function getTransactionsForStore(storeId: string): Promise<TransactionSummary> {
  const orders = await getTransactionSourceOrders(storeId);
  const rows: TransactionRow[] = [];

  for (const order of orders) {
    const amount = Number(order.totalAmount);
    rows.push({
      amount,
      createdAt: order.createdAt,
      currency: order.currency,
      customer: order.customerName,
      id: order.paymentReference || `PAY-${order.orderNumber}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.paymentStatus,
      type: "PAYMENT"
    });

    if (order.paymentStatus === "REFUNDED") {
      rows.push({
        amount,
        createdAt: order.createdAt,
        currency: order.currency,
        customer: order.customerName,
        id: `REF-${order.orderNumber}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: "COMPLETED",
        type: "REFUND"
      });
    }
  }

  const payments = sum(rows.filter((row) => row.type === "PAYMENT").map((row) => row.amount));
  const refunds = sum(rows.filter((row) => row.type === "REFUND").map((row) => row.amount));

  return {
    metrics: { netAmount: payments - refunds, payments, refunds, total: rows.length },
    rows: rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  };
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
