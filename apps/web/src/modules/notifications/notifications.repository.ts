import { prisma } from "@dash/db";
import type { MessageChannel, MessageDeliveryStatus, MessageTemplateKey } from "./notifications.types";

export async function recordMessageDelivery(data: {
  channel: MessageChannel;
  errorCode: string | null;
  errorMessage: string | null;
  provider: string;
  providerMessageId: string | null;
  recipient: string;
  status: MessageDeliveryStatus;
  storeId: string | null;
  template: MessageTemplateKey;
}) {
  return prisma.messageDelivery.create({
    data
  });
}

/** Status totals for the admin health card. */
export async function countMessageDeliveriesSince(since: Date) {
  const rows = await prisma.messageDelivery.groupBy({
    _count: {
      _all: true
    },
    by: ["status"],
    where: {
      createdAt: {
        gte: since
      }
    }
  });

  return rows.reduce<Record<MessageDeliveryStatus, number>>(
    (totals, row) => ({ ...totals, [row.status]: row._count._all }),
    { BLOCKED: 0, FAILED: 0, SENT: 0, SKIPPED: 0 }
  );
}

/**
 * What a store has actually spent this month. Only `SENT` counts — a refused or
 * unconfigured message costs nothing, and charging a plan for one would be
 * charging for a failure.
 */
export async function countStoreSmsSentSince(storeId: string, since: Date) {
  return prisma.messageDelivery.count({
    where: {
      channel: "SMS",
      createdAt: {
        gte: since
      },
      status: "SENT",
      storeId
    }
  });
}

/**
 * The most recent failures, which is what anyone opening the admin card is
 * actually looking for — a count tells them something is wrong, this tells them
 * what the gateway said.
 */
export async function listRecentMessageFailures(limit: number) {
  return prisma.messageDelivery.findMany({
    orderBy: {
      createdAt: "desc"
    },
    select: {
      channel: true,
      createdAt: true,
      errorCode: true,
      errorMessage: true,
      id: true,
      recipient: true
    },
    take: limit,
    where: {
      status: "FAILED"
    }
  });
}
