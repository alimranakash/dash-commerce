import { revalidatePath } from "next/cache";
import { getStorefrontOrigin } from "../abandoned-carts/abandoned-cart.service";
import { sendGa4PurchaseEvent } from "../marketing/ga4-mp";
import { sendMetaPurchaseEvent } from "../marketing/meta-capi";
import { sendCustomOrderSms, sendOrderConfirmationSms } from "../orders/order-sms.service";

/**
 * Everything that happens *after* an order commits.
 *
 * Extracted from `app/api/checkout/route.ts` when the AI Shopping Agent gained
 * the ability to place an order too. It is one function rather than two copies
 * because the copies would drift, and the drift is invisible from the seller's
 * side until it matters: an order placed in the chat that sends no confirmation
 * SMS looks exactly like an order that was never placed, and a purchase missing
 * from Meta and GA4 is a campaign the seller keeps paying for on bad numbers.
 *
 * Three properties are load-bearing and easy to lose in a refactor:
 *
 * - **Never called for a replay.** The caller decides. `createCheckoutOrder`
 *   returns `replayed: true` for a double-tapped submit or a cart the seller had
 *   already converted, and a second confirmation SMS to that customer is exactly
 *   the damage the submission key exists to prevent.
 * - **Every sender resolves.** The order is already committed by the time this
 *   runs, so nothing here may turn a completed purchase into a failure the
 *   shopper is shown. Each `catch` is attached per sender, so one misconfigured
 *   integration cannot suppress the other three.
 * - **The event source URL is the shop's real public address.** The request
 *   origin would report `localhost:3000` behind Caddy, which breaks GA4
 *   attribution and fails the domain check Meta runs on the event.
 */
export async function completeCheckoutOrder(params: {
  /** First-party GA cookie, when the caller has a request to read it from. */
  gaCookie?: string | undefined;
  order: {
    customerName: string;
    customerPhone: string;
    id: string;
    orderNumber: string;
    totalAmount: unknown;
  };
  store: {
    currency: string;
    id: string;
    name: string;
    slug: string;
  };
}) {
  const { gaCookie, order, store } = params;

  // Internal route on purpose: `/s/<slug>` is what Next serves, and the clean
  // address is a rewrite onto it — revalidating that would revalidate nothing.
  revalidatePath(`/s/${store.slug}`);
  revalidatePath(`/s/${store.slug}/cart`);
  revalidatePath(`/s/${store.slug}/checkout`);
  revalidatePath("/dashboard/orders");

  const storefrontOrigin = await getStorefrontOrigin(store);
  const thankYouUrl = `${storefrontOrigin.href}/thank-you/${order.orderNumber}`;

  await Promise.all([
    sendMetaPurchaseEvent({
      eventSourceUrl: thankYouUrl,
      orderId: order.id,
      storeId: store.id
    }).catch(() => undefined),
    sendGa4PurchaseEvent({
      // Stitches the server event onto the same GA4 user as the browser session
      // that placed the order.
      ...(gaCookie ? { gaCookie } : {}),
      orderId: order.id,
      pageLocation: thankYouUrl,
      storeId: store.id
    }).catch(() => undefined),
    sendOrderConfirmationSms({
      currency: store.currency,
      orderNumber: order.orderNumber,
      phone: order.customerPhone,
      storeId: store.id,
      storeName: store.name,
      total: Number(order.totalAmount)
    }).catch(() => undefined),
    sendCustomOrderSms({
      currency: store.currency,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      phone: order.customerPhone,
      storeId: store.id,
      storeName: store.name,
      total: Number(order.totalAmount)
    }).catch(() => undefined)
  ]);
}
