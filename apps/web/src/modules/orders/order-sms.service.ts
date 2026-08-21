import { normalizeBangladeshPhone } from "../courier/courier-phone";
import { sendSms } from "../notifications/notifications.service";
import {
  getStoreCustomOrderSms,
  isStoreOrderConfirmSmsEnabled
} from "../notifications/store-messaging.service";
import { customOrderSms, orderConfirmationSms } from "../notifications/templates";

/**
 * Texting a customer their order details as soon as the order is placed.
 *
 * Opt-in per store and sent through the seller's own SMS account, because this
 * is the highest-volume message the platform produces — one per order — and the
 * cost belongs to whoever made the sale.
 *
 * Silent about everything that can go wrong. A confirmed order must never be
 * reported to a shopper as a failure because a text did not go out.
 */
export async function sendOrderConfirmationSms(input: {
  currency: string;
  orderNumber: string;
  phone: string;
  storeId: string;
  storeName: string;
  total: number;
}) {
  try {
    if (!(await isStoreOrderConfirmSmsEnabled(input.storeId))) {
      return;
    }

    const phone = normalizeBangladeshPhone(input.phone);

    if (!phone) {
      return;
    }

    await sendSms({
      message: orderConfirmationSms({
        currency: input.currency,
        orderNumber: input.orderNumber,
        storeName: input.storeName,
        total: input.total
      }),
      storeId: input.storeId,
      template: "order_confirmation",
      to: phone
    });
  } catch (error) {
    console.error(`Order confirmation SMS failed for ${input.orderNumber}`, error);
  }
}

/**
 * The seller's own text to the customer on the same order.
 *
 * A second message rather than extra lines on the confirmation above, because
 * the two are switched on independently: a seller may want only their own words,
 * only the order details, or both, and merging them would make the cheap choice
 * impossible. Silent about failure for the same reason as the confirmation — the
 * order is already committed by the time this runs.
 */
export async function sendCustomOrderSms(input: {
  currency: string;
  customerName: string;
  orderNumber: string;
  phone: string;
  storeId: string;
  storeName: string;
  total: number;
}) {
  try {
    const template = await getStoreCustomOrderSms(input.storeId);

    if (!template) {
      return;
    }

    const phone = normalizeBangladeshPhone(input.phone);

    if (!phone) {
      return;
    }

    const message = customOrderSms({
      currency: input.currency,
      customerName: input.customerName,
      message: template,
      orderNumber: input.orderNumber,
      storeName: input.storeName,
      total: input.total
    });

    // Copy that is nothing but placeholders can render empty even though the
    // seller wrote something. A gateway charges for that segment all the same.
    if (!message) {
      return;
    }

    await sendSms({
      message,
      storeId: input.storeId,
      template: "order_custom",
      to: phone
    });
  } catch (error) {
    console.error(`Custom order SMS failed for ${input.orderNumber}`, error);
  }
}
