import {
  getOrderByIdForStore,
  getOrdersForStore,
  getPublicOrderByNumber,
  updateOrderFulfillmentStatusForStore,
  updateOrderPaymentStatusForStore,
  updateOrderStatusForStore,
  type FulfillmentStatus
} from "./order.repository";

export { getOrderByIdForStore, getOrdersForStore, getPublicOrderByNumber };

type OrderStatusUpdate = "CANCELLED" | "COMPLETED" | "PROCESSING";
type PaymentStatusUpdate = "PAID";

/**
 * Order status is the seller's business state and is now the only thing these
 * buttons change. Delivery progress lives on the shipment and is projected onto
 * fulfillmentStatus by the courier layer, so marking an order completed no
 * longer claims it was delivered.
 */
export async function updateOrderStatus(storeId: string, orderId: string, status: OrderStatusUpdate) {
  const result = await updateOrderStatusForStore(storeId, orderId, status);

  return result.count > 0;
}

export async function updateOrderFulfillmentStatus(
  storeId: string,
  orderId: string,
  fulfillmentStatus: FulfillmentStatus
) {
  const result = await updateOrderFulfillmentStatusForStore(storeId, orderId, fulfillmentStatus);

  return result.count > 0;
}

export async function updateOrderPaymentStatus(storeId: string, orderId: string, status: PaymentStatusUpdate) {
  const result = await updateOrderPaymentStatusForStore(storeId, orderId, status);

  return result.count > 0;
}
