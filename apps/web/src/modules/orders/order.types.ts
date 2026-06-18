import type { Prisma } from "@dash/db";

export type SellerOrderListItem = Prisma.OrderGetPayload<{
  include: {
    items: true;
  };
}>;

export type SellerOrderDetails = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    shippingAddress: true;
    billingAddress: true;
    items: true;
  };
}>;
