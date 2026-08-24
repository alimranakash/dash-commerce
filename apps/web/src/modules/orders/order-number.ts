import type { Prisma } from "@dash/db";

/**
 * The next `DASH-####` for a store.
 *
 * Shared by the storefront checkout and the dashboard's manual order form so
 * both draw from one sequence — a store whose order list mixed two numbering
 * schemes would be unreadable, and the seller quotes these numbers on the phone.
 *
 * Takes the caller's transaction client on purpose: the row it reads has to be
 * the row the caller is about to follow, which only holds inside the same
 * transaction that writes the order.
 */
export async function generateOrderNumber(tx: Prisma.TransactionClient, storeId: string) {
  const latestOrder = await tx.order.findFirst({
    where: {
      storeId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      orderNumber: true
    }
  });
  const latestNumber = latestOrder ? Number(latestOrder.orderNumber.replace("DASH-", "")) : 1000;
  const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1001;

  return `DASH-${nextNumber}`;
}
