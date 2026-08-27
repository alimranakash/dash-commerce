import { getOrderPageForStore } from "../orders/order.service";
import { decimalToString, maskEmail, maskPhone, toIsoString } from "./ai-redact";
import {
  aiOrderListResponseSchema,
  type AiOrderListResponse,
  type AiOrderQuery
} from "./ai.schema";

/**
 * The order book, redacted.
 *
 * Rows come from `order.service.ts` — the same store-scoped read the dashboard
 * uses — so there is no parallel order query system. This file is the redaction
 * layer on top of it, and it is where the difference between "the seller's
 * screen" and "an external service" is actually enforced.
 *
 * Three groups of fields are absent from `toAiOrder` on purpose:
 *
 * - **Fraud tooling.** `ipAddress`, `riskScore`, `riskLevel`, `riskFactors`,
 *   `verificationStatus`, `verifiedAt`, `markedFakeAt`, `verificationDecidedAt`.
 *   `riskFactors` is the worst of them: it spells out how the rule engine scored
 *   an order, and publishing that is publishing the evasion manual.
 * - **Contact details.** The phone and email are masked rather than sent. The
 *   name is not, because an assistant that cannot say whose order it is has
 *   little to offer, and a name is the seller's own record of their own
 *   customer.
 * - **Addresses.** City and district only. A district is enough to reason about
 *   courier performance and delivery times; `shippingArea` and the `Address`
 *   rows are somebody's home and stay behind.
 */
export async function getAiOrderPage(
  storeId: string,
  query: AiOrderQuery
): Promise<AiOrderListResponse> {
  const rows = await getOrderPageForStore({
    storeId,
    take: query.limit + 1,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.status ? { status: query.status } : {})
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return aiOrderListResponseSchema.parse({
    data: page.map((order) => toAiOrder(order, storeId)),
    page: {
      hasMore,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null
    },
    storeId
  });
}

type OrderRow = Awaited<ReturnType<typeof getOrderPageForStore>>[number];

function toAiOrder(order: OrderRow, storeId: string) {
  return {
    createdAt: toIsoString(order.createdAt),
    currency: order.currency,
    customer: {
      email: maskEmail(order.customerEmail),
      name: order.customerName,
      phone: maskPhone(order.customerPhone)
    },
    id: order.id,
    items: order.items.map((item) => ({
      id: item.id,
      price: decimalToString(item.price),
      productId: item.productId,
      quantity: item.quantity,
      sku: item.sku,
      title: item.title,
      total: decimalToString(item.total)
    })),
    orderNumber: order.orderNumber,
    paymentStatus: order.paymentStatus,
    shipping: {
      city: order.shippingCity,
      district: order.shippingDistrict
    },
    status: order.status,
    // `orderNumber` is unique per store rather than globally
    // (`@@unique([storeId, orderNumber])`), so it is never sent without the
    // store it belongs to. This is the authenticated store, not anything the
    // caller asked for.
    storeId,
    totalAmount: decimalToString(order.totalAmount)
  };
}
