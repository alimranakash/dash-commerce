import { assessOrdersForCustomerSafely } from "../fake-orders/fake-order.assessment";
import { normalizePhoneKey } from "../fake-orders/fake-order.rules";
import {
  getOrderByIdForStore,
  getOrderEditableDetailsForStore,
  getOrderRiskKeyForStore,
  getOrdersForStore,
  getPublicOrderByNumber,
  updateOrderDetailsForStore,
  updateOrderFulfillmentStatusForStore,
  updateOrderPaymentStatusForStore,
  updateOrderStatusForStore,
  type FulfillmentStatus
} from "./order.repository";
import { updateOrderDetailsSchema, type UpdateOrderDetailsInput } from "./order.schema";

export {
  getOrderByIdForStore,
  getOrderEditableDetailsForStore,
  getOrdersForStore,
  getPublicOrderByNumber
};

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

/**
 * Corrects the customer and delivery details a shopper got wrong at checkout.
 *
 * The phone number is part of the risk engine's grouping key, so changing it
 * moves the order between two customer histories — both have to be re-scored,
 * not just the one it landed in.
 */
export async function updateOrderDetails(
  storeId: string,
  orderId: string,
  input: UpdateOrderDetailsInput
) {
  const data = updateOrderDetailsSchema.parse(input);
  const before = await getOrderRiskKeyForStore(storeId, orderId);
  const order = await updateOrderDetailsForStore(storeId, orderId, data);

  if (!order) {
    return null;
  }

  if (before && normalizePhoneKey(before.customerPhone) !== normalizePhoneKey(data.customerPhone)) {
    await assessOrdersForCustomerSafely(storeId, {
      customerId: before.customerId,
      phone: before.customerPhone
    });
  }

  await assessOrdersForCustomerSafely(storeId, {
    customerId: order.customerId,
    phone: order.customerPhone
  });

  return order;
}
