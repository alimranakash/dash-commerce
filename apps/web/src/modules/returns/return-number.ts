import type { Prisma } from "@dash/db";

/**
 * The next `RET-####` for a store.
 *
 * Deliberately one sequence across all three types rather than three: a seller
 * quotes this number on the phone, and RET-1042 has to name exactly one request
 * whether it turned out to be a return, an exchange or a refund.
 *
 * Takes the caller's transaction client for the same reason generateOrderNumber
 * does — the row it reads has to be the row the caller is about to follow.
 */
export async function generateReturnNumber(tx: Prisma.TransactionClient, storeId: string) {
  const latest = await tx.orderReturn.findFirst({
    where: {
      storeId
    },
    orderBy: {
      createdAt: "desc"
    },
    select: {
      returnNumber: true
    }
  });
  const latestNumber = latest ? Number(latest.returnNumber.replace("RET-", "")) : 1000;
  const nextNumber = Number.isFinite(latestNumber) ? latestNumber + 1 : 1001;

  return `RET-${nextNumber}`;
}
