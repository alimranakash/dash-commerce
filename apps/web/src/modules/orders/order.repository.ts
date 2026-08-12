import { prisma } from "@dash/db";

type OrderStatus = "PENDING" | "CONFIRMED" | "PROCESSING" | "COMPLETED" | "CANCELLED";
export type FulfillmentStatus =
  | "UNFULFILLED"
  | "SHIPPED"
  | "PARTIALLY_FULFILLED"
  | "FULFILLED"
  | "RETURNED";
type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "CANCELLED";

export async function getOrdersForStore(storeId: string) {
  return prisma.order.findMany({
    where: {
      storeId
    },
    include: {
      items: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getOrderByIdForStore(storeId: string, orderId: string) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    include: {
      customer: true,
      shippingAddress: true,
      billingAddress: true,
      items: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}

export async function updateOrderStatusForStore(
  storeId: string,
  orderId: string,
  status: OrderStatus
) {
  return prisma.order.updateMany({
    where: {
      id: orderId,
      storeId
    },
    data: {
      status
    }
  });
}

/**
 * The only writer of fulfillmentStatus outside checkout. Owned by the courier
 * layer (shipment status projection) and by an explicit seller override.
 */
export async function updateOrderFulfillmentStatusForStore(
  storeId: string,
  orderId: string,
  fulfillmentStatus: FulfillmentStatus
) {
  return prisma.order.updateMany({
    where: {
      id: orderId,
      storeId
    },
    data: {
      fulfillmentStatus
    }
  });
}

export async function updateOrderPaymentStatusForStore(
  storeId: string,
  orderId: string,
  paymentStatus: PaymentStatus
) {
  return prisma.order.updateMany({
    where: {
      id: orderId,
      storeId
    },
    data: {
      paymentStatus
    }
  });
}

export async function getPublicOrderByNumber(storeId: string, orderNumber: string) {
  return prisma.order.findFirst({
    where: {
      storeId,
      orderNumber
    },
    include: {
      items: {
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });
}
