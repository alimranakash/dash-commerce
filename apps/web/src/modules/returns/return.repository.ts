import { prisma } from "@dash/db";
import { ensureOrderReturnSchema } from "./return-schema";
import type { OrderRefundMethod, OrderReturnStatus, OrderReturnType } from "./return.schema";

/**
 * Statuses that no longer hold any of the order's stock.
 *
 * A rejected or cancelled request has to stop counting against what is still
 * returnable, or one mistyped request would lock a line out of ever coming back.
 */
const OPEN_RETURN_STATUSES: OrderReturnStatus[] = [
  "REQUESTED",
  "APPROVED",
  "IN_TRANSIT",
  "RECEIVED",
  "COMPLETED"
];

const listInclude = {
  items: true,
  order: {
    select: {
      id: true,
      orderNumber: true
    }
  }
} as const;

const detailsInclude = {
  items: true,
  order: {
    select: {
      customerEmail: true,
      fulfillmentStatus: true,
      id: true,
      orderNumber: true,
      paymentMethodName: true,
      paymentStatus: true,
      status: true,
      totalAmount: true
    }
  }
} as const;

export async function getOrderReturnsForStore(storeId: string, type?: OrderReturnType) {
  await ensureOrderReturnSchema();

  return prisma.orderReturn.findMany({
    where: {
      storeId,
      ...(type ? { type } : {})
    },
    include: listInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getOrderReturnByIdForStore(storeId: string, returnId: string) {
  await ensureOrderReturnSchema();

  return prisma.orderReturn.findFirst({
    where: {
      id: returnId,
      storeId
    },
    include: detailsInclude
  });
}

/** Every request raised against one order, for the panel on the order page. */
export async function getOrderReturnsForOrder(storeId: string, orderId: string) {
  await ensureOrderReturnSchema();

  return prisma.orderReturn.findMany({
    where: {
      orderId,
      storeId
    },
    include: listInclude,
    orderBy: {
      createdAt: "desc"
    }
  });
}

/** The order a request is being written against, with the lines it can name. */
export async function getReturnableOrderForStore(storeId: string, orderId: string) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    select: {
      currency: true,
      customerId: true,
      customerName: true,
      customerPhone: true,
      fulfillmentStatus: true,
      id: true,
      items: {
        orderBy: {
          createdAt: "asc"
        }
      },
      orderNumber: true,
      paymentStatus: true,
      shippingAmount: true,
      status: true,
      totalAmount: true
    }
  });
}

/**
 * How many units of each order line are already spoken for by a live request.
 *
 * Keyed by `orderItemId`, which is why the request lines store one: a product id
 * would merge two lines of the same product sold at different prices.
 */
export async function getReturnedQuantitiesByOrderItem(storeId: string, orderId: string) {
  await ensureOrderReturnSchema();

  const requests = await prisma.orderReturn.findMany({
    where: {
      orderId,
      status: {
        in: OPEN_RETURN_STATUSES
      },
      storeId
    },
    select: {
      items: {
        select: {
          orderItemId: true,
          quantity: true
        }
      }
    }
  });

  return requests.reduce((counts, request) => {
    for (const item of request.items) {
      if (!item.orderItemId) continue;

      counts.set(item.orderItemId, (counts.get(item.orderItemId) ?? 0) + item.quantity);
    }

    return counts;
  }, new Map<string, number>());
}

/**
 * Orders the seller can raise a request against, newest first, for the picker.
 *
 * Cancelled orders are deliberately included: an order that was paid for and
 * then cancelled is exactly the case where a refund is owed, and filtering it
 * out would leave the seller no way to record one.
 */
export async function getReturnableOrdersForStore(storeId: string) {
  return prisma.order.findMany({
    where: {
      storeId
    },
    select: {
      createdAt: true,
      currency: true,
      customerName: true,
      customerPhone: true,
      id: true,
      orderNumber: true,
      status: true,
      totalAmount: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 200
  });
}

export async function updateOrderReturnRefundForStore(
  storeId: string,
  returnId: string,
  data: {
    refundMethod: OrderRefundMethod;
    refundReference: string | null;
    resolutionNote: string | null;
  }
) {
  await ensureOrderReturnSchema();

  return prisma.orderReturn.updateMany({
    where: {
      id: returnId,
      storeId
    },
    data
  });
}

export async function deleteOrderReturnForStore(storeId: string, returnId: string) {
  await ensureOrderReturnSchema();

  return prisma.orderReturn.deleteMany({
    where: {
      id: returnId,
      storeId
    }
  });
}
