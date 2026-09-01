import { prisma } from "@dash/db";

export type CustomerPageQuery = {
  /** The id of the last customer on the previous page. */
  cursor?: string | undefined;
  /** Matched against name, phone and email, case-insensitively. */
  search?: string | undefined;
  storeId: string;
  take: number;
};

/**
 * A page of customers, for callers that cannot hold the whole list.
 *
 * The sibling of `getCustomerRecordsForStore` rather than a replacement,
 * following `getProductPageForStore` exactly: the dashboard reads the customer
 * list whole and is fine doing so, while the external AI API has to walk it.
 * Same store scoping and the same order-shaped select, so both produce the same
 * row and there is only one place customers are read from.
 *
 * Cursor rather than offset: a list being added to while it is walked would
 * silently skip or repeat rows under `skip`/`take`. `id` takes part in the
 * ordering so the cursor stays stable when several customers share a
 * `createdAt`.
 */
export async function getCustomerPageForStore(query: CustomerPageQuery) {
  const search = query.search?.trim();

  return prisma.customer.findMany({
    where: {
      storeId: query.storeId,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" as const } },
              { phone: { contains: search, mode: "insensitive" as const } },
              { email: { contains: search, mode: "insensitive" as const } }
            ]
          }
        : {})
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: query.take,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    select: {
      createdAt: true,
      email: true,
      id: true,
      name: true,
      phone: true,
      orders: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          currency: true,
          totalAmount: true
        }
      }
    }
  });
}

export async function getCustomerRecordsForStore(storeId: string) {
  return prisma.customer.findMany({
    where: { storeId },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      email: true,
      id: true,
      name: true,
      phone: true,
      orders: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          currency: true,
          totalAmount: true
        }
      }
    }
  });
}
