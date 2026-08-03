import {
  getOrderByIdForStore,
  getOrdersForStore,
  getPublicOrderByNumber,
  updateOrderPaymentStatusForStore,
  updateOrderStatusForStore
} from "./order.repository";

export { getOrderByIdForStore, getOrdersForStore, getPublicOrderByNumber };

type OrderStatusUpdate = "CANCELLED" | "COMPLETED" | "PROCESSING";
type PaymentStatusUpdate = "PAID";

export async function updateOrderStatus(storeId: string, orderId: string, status: OrderStatusUpdate) {
  const fulfillmentStatus = status === "COMPLETED" ? "FULFILLED" : status === "CANCELLED" ? "RETURNED" : "UNFULFILLED";
  const result = await updateOrderStatusForStore(storeId, orderId, status, fulfillmentStatus);

  return result.count > 0;
}

export async function updateOrderPaymentStatus(storeId: string, orderId: string, status: PaymentStatusUpdate) {
  const result = await updateOrderPaymentStatusForStore(storeId, orderId, status);

  return result.count > 0;
}
