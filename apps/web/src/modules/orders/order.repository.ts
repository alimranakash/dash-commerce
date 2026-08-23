import { prisma } from "@dash/db";
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
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      id: true,
      notes: true,
      orderNumber: true,
      shippingAddress: true,
      shippingAddressId: true,
      shippingArea: true,
      shippingCity: true,
      shippingDistrict: true
    }
  });
}

/**
 * Writes a seller's correction across the two rows that hold it: the order's
 * denormalised customer snapshot and the Address the courier is actually given.
 *
 * `shippingDistrict`/`City`/`Area` on the order are deliberately left alone —
 * those are the snapshot of the shipping *rate* the shopper paid for, and this
 * form does not re-price the order. The courier draft prefers the address row
 * over them anyway (see courier.service buildShipmentDraft).
 */
export async function updateOrderDetailsForStore(
  storeId: string,
  orderId: string,
  data: UpdateOrderDetailsInput
) {
  const order = await prisma.order.findFirst({
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

  return prisma.$transaction(async (tx) => {
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
        notes: data.notes ?? null,
        shippingAddressId,
        // Checkout points both ids at one row. Keep that shape when the order
        // had no address yet, but never repoint a billing address that was
        // deliberately separate.
        ...(order.billingAddressId ? {} : { billingAddressId: shippingAddressId })
      }
    });
  });
}
