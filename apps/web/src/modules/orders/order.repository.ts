import { prisma, type Prisma } from "@dash/db";
import type { PaymentMethodTypeValue } from "../payments/payment.schema";
import type { UpdateOrderDetailsInput } from "./order.schema";

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

/** Bulk sibling of getOrderByIdForStore, with the same includes a booking needs. */
export async function getOrdersByIdsForStore(storeId: string, orderIds: string[]) {
  if (orderIds.length === 0) {
    return [];
  }

  return prisma.order.findMany({
    where: {
      id: {
        in: orderIds
      },
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

/** Minimal read for the risk engine's cancellation hook. */
export async function getOrderRiskKeyForStore(storeId: string, orderId: string) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    select: {
      customerId: true,
      customerPhone: true,
      status: true
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

/** The order's own copy of the customer/address fields a seller may correct. */
export async function getOrderEditableDetailsForStore(storeId: string, orderId: string) {
  return prisma.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    select: {
      billingAddressId: true,
      currency: true,
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      discountAmount: true,
      id: true,
      notes: true,
      orderNumber: true,
      paymentMethodType: true,
      paymentNote: true,
      paymentReference: true,
      shippingAddress: true,
      shippingAddressId: true,
      items: {
        orderBy: {
          createdAt: "asc"
        },
        select: {
          price: true,
          productId: true,
          quantity: true,
          title: true,
          variantId: true
        }
      },
      shippingAmount: true,
      shippingArea: true,
      shippingCity: true,
      shippingDistrict: true,
      subtotalAmount: true
    }
  });
}

/** Whether anyone else is already acting on this order's lines. */
export async function getOrderItemLocksForStore(storeId: string, orderId: string) {
  return prisma.orderReturn.count({
    where: {
      orderId,
      storeId
    }
  });
}

/** The lines' total, for a correction that is leaving the lines alone. */
export async function getOrderSubtotalForStore(
  tx: Prisma.TransactionClient,
  storeId: string,
  orderId: string
) {
  return tx.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    select: {
      subtotalAmount: true
    }
  });
}

/**
 * Writes a seller's correction across the two rows that hold it: the order's
 * denormalised customer snapshot and the Address the courier is actually given.
 *
 * `shippingDistrict`/`City`/`Area` on the order are deliberately left alone —
 * those are the snapshot of the shipping *zone* the shopper picked, and the
 * form changes what was charged, not which zone was chosen. The courier draft
 * prefers the address row over them anyway (see courier.service
 * buildShipmentDraft).
 *
 * `money` arrives already resolved and already added up: the service owns that
 * arithmetic because it owns the rule that an order cannot total less than
 * nothing.
 *
 * Takes the caller's transaction because a correction can now move stock too,
 * and a half-applied edit — new lines against an old total, or units taken out
 * for a line that was never written — is worse than a rejected one.
 */
export async function updateOrderDetailsForStore(
  tx: Prisma.TransactionClient,
  storeId: string,
  orderId: string,
  data: UpdateOrderDetailsInput,
  money: {
    discountAmount: string;
    paymentMethodName: string;
    paymentMethodType: PaymentMethodTypeValue;
    shippingAmount: string;
    subtotalAmount: string;
    totalAmount: string;
  }
) {
  const order = await tx.order.findFirst({
    where: {
      id: orderId,
      storeId
    },
    select: {
      billingAddressId: true,
      customerId: true,
      shippingAddressId: true
    }
  });

  if (!order) {
    return null;
  }

  const addressData = {
    addressLine1: data.addressLine1,
    addressLine2: data.addressLine2 ?? null,
    area: data.area ?? null,
    city: data.city ?? null,
    country: data.country,
    district: data.district,
    email: data.customerEmail ?? null,
    name: data.customerName,
    phone: data.customerPhone,
    postalCode: data.postalCode ?? null
  };

  {
    let shippingAddressId = order.shippingAddressId;

    if (shippingAddressId) {
      // Scoped by storeId as well as id: an address id can only be corrected by
      // the store that owns it, even though we reached it through the order.
      await tx.address.updateMany({
        where: {
          id: shippingAddressId,
          storeId
        },
        data: addressData
      });
    } else {
      const created = await tx.address.create({
        data: {
          storeId,
          customerId: order.customerId,
          ...addressData
        }
      });

      shippingAddressId = created.id;
    }

    return tx.order.update({
      where: {
        id: orderId,
        storeId
      },
      data: {
        customerEmail: data.customerEmail ?? null,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        discountAmount: money.discountAmount,
        notes: data.notes ?? null,
        paymentMethodName: money.paymentMethodName,
        paymentMethodType: money.paymentMethodType,
        paymentNote: data.paymentNote ?? null,
        paymentReference: data.paymentReference ?? null,
        shippingAddressId,
        shippingAmount: money.shippingAmount,
        subtotalAmount: money.subtotalAmount,
        totalAmount: money.totalAmount,
        // Checkout points both ids at one row. Keep that shape when the order
        // had no address yet, but never repoint a billing address that was
        // deliberately separate.
        ...(order.billingAddressId ? {} : { billingAddressId: shippingAddressId })
      }
    });
  }
}
