import { prisma } from "@dash/db";
import type { CustomerFlagStatus, VerificationStatus } from "./fake-order.types";

export async function getOrdersForRiskReview(storeId: string) {
  return prisma.order.findMany({
    where: {
      storeId
    },
    include: {
      billingAddress: true,
      customer: true,
      items: true,
      shippingAddress: true
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function getRiskOrderByIdForStore(storeId: string, orderId: string) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    include: {
      billingAddress: true,
      customer: true,
      items: {
        orderBy: {
          createdAt: "asc"
        }
      },
      shippingAddress: true
    }
  });
}

export async function updateOrderVerificationStatus(
  storeId: string,
  orderId: string,
  status: VerificationStatus
) {
  return prisma.order.updateMany({
    where: {
      id: orderId,
      storeId
    },
    data: {
      markedFakeAt: status === "FAKE" ? new Date() : null,
      verificationStatus: status,
      verifiedAt: status === "VERIFIED" ? new Date() : null
    }
  });
}

export async function updateCustomerFlagStatus(storeId: string, customerId: string, status: CustomerFlagStatus) {
  return prisma.customer.updateMany({
    where: {
      id: customerId,
      storeId
    },
    data: {
      flagStatus: status
    }
  });
}
