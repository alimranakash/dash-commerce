import { normalizeBangladeshPhone } from "../courier/courier-phone";
import { sendSms } from "../notifications/notifications.service";
import { isStoreOrderConfirmSmsEnabled } from "../notifications/store-messaging.service";
import { orderConfirmationSms } from "../notifications/templates";

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
