import { prisma } from "@dash/db";

/**
 * The orders a device is holding receipts for.
 *
 * Scoped by `storeId` **and** by the exact ids the cookie named: the shopper is
 * shown their own purchases, never a phone number's history, so a second person
 * on the same handset — or the same shopper on a friend's phone — cannot read a
 * purchase they did not make on this device.
 *
 * Every field is named. An `Order` row also carries `riskScore`, `riskFactors`,
 * `ipAddress`, `markedFakeAt` and `verificationStatus`, which are the seller's
 * private judgement of the customer standing in front of them; a spread here
 * would publish all five to that customer the day someone widens the query.
 */
export function findGuestOrdersByIds(storeId: string, ids: readonly string[]) {
  if (ids.length === 0) {
    return Promise.resolve([]);
  }

  return prisma.order.findMany({
    where: {
      id: { in: [...ids] },
      storeId
    },
    select: {
      bundleDiscountAmount: true,
      createdAt: true,
      currency: true,
      customerEmail: true,
      customerName: true,
      customerPhone: true,
      discountAmount: true,
      fulfillmentStatus: true,
      id: true,
      orderNumber: true,
      paymentMethodName: true,
      paymentStatus: true,
      shippingAddress: {
        select: {
          addressLine1: true,
          addressLine2: true,
          area: true,
          city: true,
          country: true,
          district: true,
          postalCode: true
        }
      },
      shippingAmount: true,
      shippingArea: true,
      shippingCity: true,
      shippingDistrict: true,
      shippingRateName: true,
      status: true,
      subtotalAmount: true,
      taxAmount: true,
      totalAmount: true,
      items: {
        orderBy: {
          createdAt: "asc"
        },
        select: {
          id: true,
          imageUrl: true,
          isPreorder: true,
          quantity: true,
          title: true,
          total: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}
