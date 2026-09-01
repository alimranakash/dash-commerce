import { getCustomerPageForStore } from "../customers/customer.repository";
import { maskEmail, maskPhone, toIsoString } from "./ai-redact";
import {
  aiCustomerListResponseSchema,
  type AiCustomerListResponse,
  type AiCustomerQuery
} from "./ai.schema";

/**
 * The customer list, as the AI is allowed to read it.
 *
 * A mapper, not a data layer — the same shape as `ai-products.service.ts`. The
 * rows come from `customer.repository.ts`, so there is no second place customers
 * are queried from and no second set of tenant rules to keep in step.
 *
 * What this file adds is the redaction, and here it is the point rather than a
 * precaution: the totals and the ranking are what makes an assistant useful
 * ("who are my best customers", "how many came back this month"), while the
 * phone numbers and email addresses behind them are the store's contact book.
 * Masking through `ai-redact.ts` keeps the first and withholds the second, so a
 * leaked key cannot be turned into a marketing list.
 *
 * `totalSpent` is summed here rather than in SQL because the repository already
 * loads the orders for the count, and a second aggregate query could disagree
 * with the list it describes.
 */
export async function getAiCustomerPage(
  storeId: string,
  query: AiCustomerQuery,
  fallbackCurrency: string
): Promise<AiCustomerListResponse> {
  // One more than asked for: whether a next page exists is a fact about the
  // database, and the alternative — a second `count` query — can disagree with
  // the page it describes.
  const rows = await getCustomerPageForStore({
    storeId,
    take: query.limit + 1,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.search ? { search: query.search } : {})
  });
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;

  return aiCustomerListResponseSchema.parse({
    data: page.map((customer) => toAiCustomer(customer, fallbackCurrency)),
    page: {
      hasMore,
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null
    },
    storeId
  });
}

type CustomerRow = Awaited<ReturnType<typeof getCustomerPageForStore>>[number];

function toAiCustomer(customer: CustomerRow, fallbackCurrency: string) {
  const totalSpent = customer.orders.reduce(
    (total, order) => total + Number(order.totalAmount),
    0
  );

  return {
    createdAt: toIsoString(customer.createdAt),
    currency: customer.orders[0]?.currency ?? fallbackCurrency,
    email: maskEmail(customer.email),
    id: customer.id,
    lastOrderAt: customer.orders[0] ? toIsoString(customer.orders[0].createdAt) : null,
    name: customer.name,
    orderCount: customer.orders.length,
    phone: maskPhone(customer.phone),
    // Fixed to two places rather than left as a float: this is money, and the
    // rest of the API states money as a string for exactly that reason.
    totalSpent: totalSpent.toFixed(2)
  };
}
