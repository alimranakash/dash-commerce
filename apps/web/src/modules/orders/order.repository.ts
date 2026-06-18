import { prisma } from "@dash/db";

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
