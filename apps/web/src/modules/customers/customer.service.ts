import { getCustomerRecordsForStore } from "./customer.repository";
import type { CustomerSummary } from "./customer.types";

export async function getCustomersForStore(storeId: string, fallbackCurrency: string): Promise<CustomerSummary> {
  const customers = await getCustomerRecordsForStore(storeId);
  const newCustomerStart = new Date();
  newCustomerStart.setDate(newCustomerStart.getDate() - 30);
  newCustomerStart.setHours(0, 0, 0, 0);

  const rows = customers.map((customer) => ({
    createdAt: customer.createdAt,
    currency: customer.orders[0]?.currency ?? fallbackCurrency,
    email: customer.email,
    id: customer.id,
    lastOrderAt: customer.orders[0]?.createdAt ?? null,
    name: customer.name,
    orderCount: customer.orders.length,
    phone: customer.phone,
    totalSpent: customer.orders.reduce((total, order) => total + Number(order.totalAmount), 0)
  }));
  const totalSpent = rows.reduce((total, customer) => total + customer.totalSpent, 0);

  return {
    metrics: {
      averageValue: rows.length ? totalSpent / rows.length : 0,
      newCustomers: rows.filter((customer) => customer.createdAt >= newCustomerStart).length,
      returning: rows.filter((customer) => customer.orderCount > 1).length,
      total: rows.length
    },
    rows
  };
}
