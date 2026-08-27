import { assessOrdersForCustomerSafely } from "../fake-orders/fake-order.assessment";
import { normalizePhoneKey } from "../fake-orders/fake-order.rules";
import { prisma } from "@dash/db";
import { getPaymentMethods } from "../payments/payment.service";
import { assertOrderItemsEditable, replaceOrderItems } from "./order-edit.service";
import {
  getOrderByIdForStore,
  getOrderEditableDetailsForStore,
  getOrderPageForStore,
  getOrderRiskKeyForStore,
  getOrderSubtotalForStore,
  getOrdersForStore,
  getPublicOrderByNumber,
  updateOrderDetailsForStore,
  updateOrderFulfillmentStatusForStore,
  updateOrderPaymentStatusForStore,
  updateOrderStatusForStore,
  type FulfillmentStatus
} from "./order.repository";
import {
  updateOrderDetailsSchema,
  type UpdateOrderDetailsFormInput,
  type UpdateOrderDetailsInput
} from "./order.schema";

export {
  getOrderByIdForStore,
  getOrderEditableDetailsForStore,
  getOrderPageForStore,
  getOrdersForStore,
  getPublicOrderByNumber
};
export type { OrderPageQuery, OrderStatus } from "./order.repository";

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
/**
 * The money a seller is setting, resolved against the store.
 *
 * Any configured payment method is allowed, not only the ones switched on for
 * the storefront, because a seller may take bKash on a call while public
 * checkout offers only cash. The subtotal is not theirs to state — it arrives
 * from the lines that were just written.
 */
async function resolveEditedMoney(
  storeId: string,
  data: UpdateOrderDetailsInput,
  subtotalAmount: string
) {
  const paymentMethod = (await getPaymentMethods(storeId)).find(
    (method) => method.type === data.paymentMethod
  );

  if (!paymentMethod) {
    throw new Error("Selected payment method is not available.");
  }

  const shippingAmount = data.shippingAmount ?? "0.00";
  const discountAmount = data.discountAmount ?? "0.00";
  const totalAmount = (
    Number(subtotalAmount) +
    Number(shippingAmount) -
    Number(discountAmount)
  ).toFixed(2);

  if (Number(totalAmount) < 0) {
    throw new Error("The discount is larger than the order total.");
  }

  return {
    discountAmount,
    paymentMethodName: paymentMethod.name,
    paymentMethodType: paymentMethod.type,
    shippingAmount,
    subtotalAmount,
    totalAmount
  };
}

/**
 * One transaction for the whole correction.
 *
 * The guards run first and outside it: refusing a booked or returned order is
 * a decision about the order, not a write, and there is nothing to roll back.
 * Everything after that — stock returned, stock taken, lines rewritten,
 * address corrected, order re-totalled — commits together or not at all.
 */
export async function updateOrderDetails(
  storeId: string,
  orderId: string,
  input: UpdateOrderDetailsFormInput
) {
  const data = updateOrderDetailsSchema.parse(input);
  const items = data.items;
  const before = await getOrderRiskKeyForStore(storeId, orderId);

  // Only a correction that actually rewrites the basket has to answer to the
  // courier and to open returns. One that is fixing a phone number does not.
  if (items) {
    await assertOrderItemsEditable(storeId, orderId);
  }

  const order = await prisma.$transaction(async (tx) => {
    const subtotalAmount = items
      ? (await replaceOrderItems(tx, storeId, orderId, items)).subtotalAmount
      : (await getOrderSubtotalForStore(tx, storeId, orderId))?.subtotalAmount;

    if (subtotalAmount === undefined) {
      return null;
    }

    const money = await resolveEditedMoney(storeId, data, String(subtotalAmount));

    return updateOrderDetailsForStore(tx, storeId, orderId, data, money);
  });

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
