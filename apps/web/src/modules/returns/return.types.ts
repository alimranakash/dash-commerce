import type { Prisma } from "@dash/db";
import type {
  OrderRefundMethod,
  OrderReturnReason,
  OrderReturnStatus,
  OrderReturnType
} from "./return.schema";

export type OrderReturnListItem = Prisma.OrderReturnGetPayload<{
  include: {
    items: true;
    order: {
      select: {
        id: true;
        orderNumber: true;
      };
    };
  };
}>;

export type OrderReturnDetails = Prisma.OrderReturnGetPayload<{
  include: {
    items: true;
    order: {
      select: {
        customerEmail: true;
        fulfillmentStatus: true;
        id: true;
        orderNumber: true;
        paymentMethodName: true;
        paymentStatus: true;
        status: true;
        totalAmount: true;
      };
    };
  };
}>;

/**
 * The nouns the seller sees. Kept beside the enums rather than inside the
 * components because the list, the detail page and the order panel all print the
 * same words, and a request that read "Wrong Item" in one place and
 * "WRONG_ITEM" in another would look broken.
 */
export const orderReturnTypeLabels: Record<OrderReturnType, string> = {
  EXCHANGE: "Exchange",
  REFUND: "Refund",
  RETURN: "Return"
};

export const orderReturnStatusLabels: Record<OrderReturnStatus, string> = {
  APPROVED: "Approved",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  IN_TRANSIT: "Coming back",
  RECEIVED: "Received",
  REJECTED: "Rejected",
  REQUESTED: "Requested"
};

export const orderReturnReasonLabels: Record<OrderReturnReason, string> = {
  CHANGED_MIND: "Changed mind",
  DAMAGED: "Damaged in delivery",
  DEFECTIVE: "Defective product",
  LATE_DELIVERY: "Delivered too late",
  NOT_AS_DESCRIBED: "Not as described",
  OTHER: "Other",
  SIZE_ISSUE: "Wrong size or fit",
  WRONG_ITEM: "Wrong item sent"
};

export const orderRefundMethodLabels: Record<OrderRefundMethod, string> = {
  BANK: "Bank transfer",
  BKASH: "bKash",
  CASH: "Cash",
  NAGAD: "Nagad",
  NONE: "No refund",
  ORIGINAL_PAYMENT: "Original payment method",
  ROCKET: "Rocket",
  STORE_CREDIT: "Store credit"
};
