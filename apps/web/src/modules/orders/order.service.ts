import { assessOrdersForCustomerSafely } from "../fake-orders/fake-order.assessment";
import {
  getOrderByIdForStore,
  getOrderRiskKeyForStore,
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
  const before = await getOrderRiskKeyForStore(storeId, orderId);
  const result = await updateOrderStatusForStore(storeId, orderId, status);

  // "Multiple cancelled orders" is counted across the customer's whole history,
  // so crossing the CANCELLED boundary in either direction re-scores its siblings.
  if (result.count > 0 && before && (status === "CANCELLED") !== (before.status === "CANCELLED")) {
    await assessOrdersForCustomerSafely(storeId, {
      customerId: before.customerId,
      phone: before.customerPhone
    });
  }

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
