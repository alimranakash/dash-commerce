import { prisma, type Prisma } from "@dash/db";
import { generateReturnNumber } from "./return-number";
import { ensureOrderReturnSchema } from "./return-schema";
import {
  deleteOrderReturnForStore,
  getOrderReturnByIdForStore,
  getOrderReturnsForOrder,
  getOrderReturnsForStore,
  getReturnableOrderForStore,
  getReturnableOrdersForStore,
  getReturnedQuantitiesByOrderItem,
  updateOrderReturnRefundForStore
} from "./return.repository";
import {
  createOrderReturnSchema,
  recordOrderReturnRefundSchema,
  type CreateOrderReturnInput,
  type OrderReturnStatus,
  type OrderReturnType,
  type RecordOrderReturnRefundInput
} from "./return.schema";

export {
  getOrderReturnByIdForStore,
  getOrderReturnsForOrder,
  getOrderReturnsForStore,
  getReturnableOrderForStore,
  getReturnableOrdersForStore,
  getReturnedQuantitiesByOrderItem
};

type ReturnStore = {
  id: string;
  organizationId: string;
};

type ReturnWithItems = Prisma.OrderReturnGetPayload<{ include: { items: true } }>;

type MergedReturnLine = {
  orderItemId: string;
  quantity: number;
  replacementProductId?: string | undefined;
  replacementQuantity: number;
};

/**
 * Where a request may go next.
 *
 * Every move a seller can make passes through this table, which is what stops a
 * rejected request being quietly refunded later or a request being received
 * twice — the second attempt has no edge to travel.
 */
const ALLOWED_TRANSITIONS: Record<OrderReturnStatus, OrderReturnStatus[]> = {
  APPROVED: ["IN_TRANSIT", "RECEIVED", "COMPLETED", "CANCELLED"],
  CANCELLED: [],
  COMPLETED: [],
  IN_TRANSIT: ["RECEIVED", "CANCELLED"],
  RECEIVED: ["COMPLETED", "CANCELLED"],
  REJECTED: [],
  REQUESTED: ["APPROVED", "REJECTED", "CANCELLED"]
};

/** Statuses that only mean something when goods are physically coming back. */
const GOODS_ONLY_STATUSES: OrderReturnStatus[] = ["IN_TRANSIT", "RECEIVED"];

/** Requests a seller may still throw away rather than keep as history. */
const DELETABLE_STATUSES: OrderReturnStatus[] = ["REQUESTED", "REJECTED", "CANCELLED"];

/**
 * Opens a return, exchange or refund against an order.
 *
 * Nothing about the money is taken from the client. Unit prices are read off the
 * order lines — not off the product, which may have been re-priced since — and
 * replacement prices off the product, which is what the seller is actually
 * handing over today. The one number the seller may name outright is a flat
 * refund with no lines behind it.
 *
 * No stock moves here. A request is a claim, not a settlement: the shelf only
 * changes when the goods are received and when the exchange goes back out.
 */
export async function createOrderReturn(store: ReturnStore, input: CreateOrderReturnInput) {
  const data = createOrderReturnSchema.parse(input);

  await ensureOrderReturnSchema();

  const order = await getReturnableOrderForStore(store.id, data.orderId);

  if (!order) {
    throw new Error("Order not found for this store.");
  }

  const alreadyReturned = await getReturnedQuantitiesByOrderItem(store.id, order.id);
  const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
  const lines: Prisma.OrderReturnItemCreateManyOrderReturnInput[] = [];
  let itemsAmount = 0;
  let replacementAmount = 0;

  for (const line of mergeReturnLines(data.items)) {
    const orderItem = orderItemsById.get(line.orderItemId);

    if (!orderItem) {
      throw new Error("One of the selected lines is not part of this order.");
    }

    const remaining = orderItem.quantity - (alreadyReturned.get(orderItem.id) ?? 0);

    if (line.quantity > remaining) {
      throw new Error(
        remaining > 0
          ? `Only ${remaining} of ${orderItem.title} is still open for a return.`
          : `${orderItem.title} has already been returned in full.`
      );
    }

    const unitPrice = Number(orderItem.price);
    const total = unitPrice * line.quantity;

    itemsAmount += total;

    const replacement =
      data.type === "EXCHANGE" && line.replacementProductId
        ? await loadReplacementProduct(store.id, line.replacementProductId)
        : null;
    // A blank replacement quantity means the obvious thing: one out for each
    // unit coming back.
    const replacementQuantity = replacement ? line.replacementQuantity || line.quantity : 0;

    if (replacement) {
      replacementAmount += Number(replacement.price) * replacementQuantity;
    }

    lines.push({
      imageUrl: orderItem.imageUrl,
      orderItemId: orderItem.id,
      productId: orderItem.productId,
      quantity: line.quantity,
      replacementProductId: replacement?.id ?? null,
      replacementQuantity,
      replacementSku: replacement?.sku ?? null,
      replacementTitle: replacement?.title ?? null,
      replacementUnitPrice: replacement ? Number(replacement.price).toFixed(2) : null,
      sku: orderItem.sku,
      title: orderItem.title,
      total: total.toFixed(2),
      unitPrice: unitPrice.toFixed(2)
    });
  }

  // A refund with no lines behind it is priced by the seller outright; anything
  // with lines is priced by what those lines were sold for.
  const goodsAmount = lines.length ? itemsAmount : Number(data.flatRefundAmount ?? 0);
  const shippingRefundAmount = Number(data.shippingRefundAmount ?? 0);
  const restockingFee = Number(data.restockingFee ?? 0);

  if (restockingFee > goodsAmount + shippingRefundAmount) {
    throw new Error("The restocking fee cannot be more than what is being returned.");
  }

  const net = goodsAmount + shippingRefundAmount - restockingFee - replacementAmount;
  // Only an exchange can leave the customer owing: on a return or a refund the
  // fee is capped above, so the balance never crosses zero.
  const refundAmount = Math.max(0, net);
  const dueAmount = data.type === "EXCHANGE" ? Math.max(0, -net) : 0;

  return prisma.$transaction(async (tx) => {
    const returnNumber = await generateReturnNumber(tx, store.id);

    return tx.orderReturn.create({
      data: {
        currency: order.currency,
        customerId: order.customerId,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        dueAmount: dueAmount.toFixed(2),
        items: {
          createMany: {
            data: lines
          }
        },
        itemsAmount: goodsAmount.toFixed(2),
        orderId: order.id,
        reason: data.reason,
        reasonNote: data.reasonNote ?? null,
        refundAmount: refundAmount.toFixed(2),
        refundMethod: data.refundMethod,
        replacementAmount: replacementAmount.toFixed(2),
        // A refund never collects goods, so there is nothing to put back and the
        // toggle would only mislead.
        restockItems: data.type === "REFUND" ? false : data.restockItems,
        restockingFee: restockingFee.toFixed(2),
        returnNumber,
        shippingRefundAmount: shippingRefundAmount.toFixed(2),
        status: "REQUESTED",
        storeId: store.id,
        type: data.type
      },
      include: {
        items: true
      }
    });
  });
}

/**
 * Moves a request one step and performs whatever that step means in the world.
 *
 * Receiving puts the goods back on the shelf; completing an exchange takes the
 * replacement off it and, when the money covers the whole order, marks the order
 * refunded. All of it runs in one transaction with the status write, because a
 * request that says RECEIVED while the stock never moved is worse than one that
 * failed outright.
 */
export async function advanceOrderReturnStatus(
  store: ReturnStore,
  returnId: string,
  next: OrderReturnStatus
) {
  await ensureOrderReturnSchema();

  return prisma.$transaction(async (tx) => {
    const request = await tx.orderReturn.findFirst({
      where: {
        id: returnId,
        storeId: store.id
      },
      include: {
        items: true
      }
    });

    if (!request) {
      throw new Error("Return request not found for this store.");
    }

    const current = request.status as OrderReturnStatus;
    const type = request.type as OrderReturnType;

    if (!ALLOWED_TRANSITIONS[current].includes(next)) {
      throw new Error(
        `A ${describeStatus(current)} request cannot be moved to ${describeStatus(next)}.`
      );
    }

    if (type === "REFUND" && GOODS_ONLY_STATUSES.includes(next)) {
      throw new Error(
        "A refund has no goods coming back, so it goes straight from approved to completed."
      );
    }

    if (type !== "REFUND" && next === "COMPLETED" && current === "APPROVED") {
      throw new Error("Mark the goods received before settling this request.");
    }

    const now = new Date();
    const restocking = next === "RECEIVED" && request.restockItems && !request.restockedAt;

    if (restocking) {
      await restockReturnedItems(tx, store, request);
    }

    if (next === "COMPLETED" && type === "EXCHANGE") {
      await reserveReplacementItems(tx, store, request);
    }

    const refundAmount = Number(request.refundAmount);

    await tx.orderReturn.update({
      where: {
        id: request.id
      },
      data: {
        status: next,
        ...(next === "APPROVED" ? { approvedAt: now } : {}),
        ...(next === "REJECTED" ? { rejectedAt: now } : {}),
        ...(next === "RECEIVED" ? { receivedAt: now } : {}),
        ...(next === "CANCELLED" ? { cancelledAt: now } : {}),
        ...(next === "COMPLETED"
          ? {
              completedAt: now,
              ...(refundAmount > 0 ? { refundedAt: now } : {})
            }
          : {}),
        ...(restocking ? { restockedAt: now } : {})
      }
    });

    if (next === "COMPLETED") {
      await projectSettlementOntoOrder(tx, store.id, request.orderId);
    }

    return request.orderId;
  });
}

/**
 * Records how the money went back, then settles the request.
 *
 * One action rather than two because they are one moment for the seller: they
 * send the bKash, they type the transaction id, the request is done.
 *
 * The transition is checked before the payment details are written, so a request
 * that cannot be settled yet does not end up carrying a transaction id for a
 * refund that never closed.
 */
export async function recordOrderReturnRefund(
  store: ReturnStore,
  returnId: string,
  input: RecordOrderReturnRefundInput
) {
  const data = recordOrderReturnRefundSchema.parse(input);
  const request = await getOrderReturnByIdForStore(store.id, returnId);

  if (!request) {
    throw new Error("Return request not found for this store.");
  }

  if (!ALLOWED_TRANSITIONS[request.status as OrderReturnStatus].includes("COMPLETED")) {
    throw new Error(
      `A ${describeStatus(request.status as OrderReturnStatus)} request cannot be settled.`
    );
  }

  const updated = await updateOrderReturnRefundForStore(store.id, returnId, {
    refundMethod: data.refundMethod,
    refundReference: data.refundReference ?? null,
    resolutionNote: data.resolutionNote ?? null
  });

  if (updated.count === 0) {
    throw new Error("Return request not found for this store.");
  }

  return advanceOrderReturnStatus(store, returnId, "COMPLETED");
}

/**
 * Throws away a request that never became anything.
 *
 * Only the three statuses that moved neither goods nor money: a settled request
 * is the record of a refund that was actually paid, and deleting it would erase
 * the only trace of it.
 */
export async function deleteOrderReturn(storeId: string, returnId: string) {
  const request = await getOrderReturnByIdForStore(storeId, returnId);

  if (!request) {
    throw new Error("Return request not found for this store.");
  }

  if (!DELETABLE_STATUSES.includes(request.status as OrderReturnStatus)) {
    throw new Error("Only a requested, rejected or cancelled request can be deleted.");
  }

  const result = await deleteOrderReturnForStore(storeId, returnId);

  return result.count > 0;
}

async function restockReturnedItems(
  tx: Prisma.TransactionClient,
  store: ReturnStore,
  request: ReturnWithItems
) {
  for (const item of request.items) {
    if (!item.productId || item.quantity <= 0) continue;

    const product = await tx.product.findFirst({
      where: {
        id: item.productId,
        storeId: store.id
      },
      select: {
        id: true,
        stockQuantity: true
      }
    });

    // The product was deleted since the order. There is no shelf to put it back
    // on, and refusing the whole receipt over it would strand the request.
    if (!product) continue;

    const previousQuantity = product.stockQuantity;
    const newQuantity = previousQuantity + item.quantity;

    await tx.product.update({
      where: {
        id: product.id
      },
      data: {
        stockQuantity: newQuantity
      }
    });

    await tx.stockMovement.create({
      data: {
        createdBy: null,
        newQuantity,
        notes: null,
        organizationId: store.organizationId,
        previousQuantity,
        productId: product.id,
        quantityChange: item.quantity,
        reason: `${request.returnNumber} received`,
        sourceId: request.id,
        sourceType: "RETURN",
        storeId: store.id,
        type: "RETURN"
      }
    });
  }
}

async function reserveReplacementItems(
  tx: Prisma.TransactionClient,
  store: ReturnStore,
  request: ReturnWithItems
) {
  for (const item of request.items) {
    if (!item.replacementProductId || item.replacementQuantity <= 0) continue;

    // The same guarded decrement checkout uses: the `gte` in the filter is what
    // makes "is there stock" and "take the stock" one atomic step.
    const updated = await tx.product.updateMany({
      where: {
        id: item.replacementProductId,
        stockQuantity: {
          gte: item.replacementQuantity
        },
        storeId: store.id
      },
      data: {
        stockQuantity: {
          decrement: item.replacementQuantity
        }
      }
    });

    if (updated.count !== 1) {
      throw new Error(
        `${item.replacementTitle ?? "The replacement product"} does not have enough stock for this exchange.`
      );
    }

    const product = await tx.product.findFirst({
      where: {
        id: item.replacementProductId,
        storeId: store.id
      },
      select: {
        stockQuantity: true
      }
    });
    const newQuantity = product?.stockQuantity ?? 0;

    await tx.stockMovement.create({
      data: {
        createdBy: null,
        newQuantity,
        notes: null,
        organizationId: store.organizationId,
        previousQuantity: newQuantity + item.replacementQuantity,
        productId: item.replacementProductId,
        quantityChange: -item.replacementQuantity,
        reason: `${request.returnNumber} exchange sent`,
        sourceId: request.id,
        sourceType: "RETURN",
        storeId: store.id,
        type: "STOCK_OUT"
      }
    });
  }
}

/**
 * Writes what the settled requests mean back onto the order itself.
 *
 * `REFUNDED` is only set once the settled refunds cover the whole order, because
 * the reports read that flag as "this order's full value came back" and summing a
 * partially refunded order at its total would overstate refunds. Same idea for
 * `RETURNED`: it means every line came back, not some of them.
 */
async function projectSettlementOntoOrder(
  tx: Prisma.TransactionClient,
  storeId: string,
  orderId: string
) {
  const order = await tx.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    select: {
      items: {
        select: {
          id: true,
          quantity: true
        }
      },
      paymentStatus: true,
      totalAmount: true
    }
  });

  if (!order) return;

  const settled = await tx.orderReturn.findMany({
    where: {
      orderId,
      status: "COMPLETED",
      storeId
    },
    select: {
      items: {
        select: {
          orderItemId: true,
          quantity: true
        }
      },
      refundAmount: true,
      type: true
    }
  });

  const refunded = settled.reduce((sum, request) => sum + Number(request.refundAmount), 0);
  const returnedByOrderItem = new Map<string, number>();

  for (const request of settled) {
    // An exchange hands the customer replacement goods, so its lines came back
    // but the order was not returned — only a plain return can empty it.
    if (request.type !== "RETURN") continue;

    for (const item of request.items) {
      if (!item.orderItemId) continue;

      returnedByOrderItem.set(
        item.orderItemId,
        (returnedByOrderItem.get(item.orderItemId) ?? 0) + item.quantity
      );
    }
  }

  const fullyReturned =
    order.items.length > 0 &&
    order.items.every((item) => (returnedByOrderItem.get(item.id) ?? 0) >= item.quantity);
  const fullyRefunded =
    refunded > 0 && refunded >= Number(order.totalAmount) && order.paymentStatus === "PAID";

  if (!fullyReturned && !fullyRefunded) {
    return;
  }

  await tx.order.update({
    where: {
      id: orderId
    },
    data: {
      ...(fullyReturned ? { fulfillmentStatus: "RETURNED" as const } : {}),
      ...(fullyRefunded ? { paymentStatus: "REFUNDED" as const } : {})
    }
  });
}

async function loadReplacementProduct(storeId: string, productId: string) {
  const product = await prisma.product.findFirst({
    where: {
      id: productId,
      status: {
        not: "ARCHIVED"
      },
      storeId
    },
    select: {
      id: true,
      price: true,
      sku: true,
      title: true
    }
  });

  if (!product) {
    throw new Error("One of the replacement products is no longer available.");
  }

  return product;
}

/**
 * Two rows naming the same order line are one line for twice the quantity.
 *
 * Without this the remaining-quantity check would pass on each row separately and
 * let a seller return three of a pair they only sold two of.
 */
function mergeReturnLines(lines: MergedReturnLine[]) {
  const merged = new Map<string, MergedReturnLine>();

  for (const line of lines) {
    const existing = merged.get(line.orderItemId);

    if (!existing) {
      merged.set(line.orderItemId, { ...line });
      continue;
    }

    existing.quantity += line.quantity;
    existing.replacementQuantity += line.replacementQuantity;
    existing.replacementProductId ??= line.replacementProductId;
  }

  return [...merged.values()];
}

function describeStatus(status: OrderReturnStatus) {
  return status.toLowerCase().replace(/_/g, " ");
}
